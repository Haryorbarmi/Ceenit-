import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';

// PGlite is a real Postgres that runs inside the Node process, so nothing needs installing on a laptop.
// With a DATABASE_URL the same SQL runs on a hosted Postgres (Neon) through a `pg` pool. Without one it uses PGlite.
// Every query here is plain Postgres SQL, so no other file cares which one it is.

export type Db = {
  query<T = Record<string, any>>(sql: string, params?: unknown[]): Promise<T[]>;
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
};

const SCHEMA = `
create table if not exists sellers (
  id text primary key,
  slug text unique not null,
  full_name text not null,
  shop_name text not null,
  category text not null,
  city text not null,
  contact text unique not null,
  contact_method text not null,
  plan text not null default 'free',
  created_at timestamptz not null default now()
);

create table if not exists wallets (
  id text primary key,
  seller_id text not null references sellers(id),
  address text not null,
  network text not null default 'TRON',
  token text not null default 'USDT',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists wallets_one_active on wallets(seller_id) where active;

create table if not exists invoices (
  id text primary key,
  seller_id text not null references sellers(id),
  wallet_address text not null,
  item text not null,
  buyer_reference text not null default '',
  base_micro bigint not null,
  cents int not null check (cents between 1 and 99),
  amount_micro bigint not null,
  token text not null default 'USDT',
  network text not null default 'TRON',
  status text not null,
  expiry_minutes int not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  parent_id text,
  next_id text,
  request_count int not null default 0,
  ack_no_cancel boolean not null
);
-- Two open links on one wallet can never have the same exact amount. This is what keeps payments matchable.
create unique index if not exists invoices_open_amount on invoices(wallet_address, amount_micro) where status in ('pending', 'confirming');
create index if not exists invoices_seller on invoices(seller_id, created_at desc);

create table if not exists payments (
  tx_id text primary key,
  wallet_address text not null,
  invoice_id text references invoices(id),
  from_address text not null,
  amount_micro bigint not null,
  block_number bigint,
  block_time timestamptz not null,
  outcome text not null,
  success boolean,
  confirmed boolean not null default false,
  confirmations int not null default 0,
  checks jsonb not null default '{}',
  reason text,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payments_invoice on payments(invoice_id);

create table if not exists link_requests (
  id text primary key,
  invoice_id text not null references invoices(id),
  buyer_name text not null default '',
  status text not null default 'pending',
  new_invoice_id text,
  created_at timestamptz not null default now()
);

create table if not exists otp_codes (
  contact text primary key,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  sent_count int not null default 1,
  window_start timestamptz not null default now()
);

-- Subscriptions (Paystack). plan_until is when the paid month runs out. Empty means no expiry (free, or given by us).
alter table sellers add column if not exists plan_until timestamptz;
alter table sellers add column if not exists sub_cancelled boolean not null default false;
alter table sellers add column if not exists paystack_customer text;

-- One row per successful subscription payment, so a payment can never be counted twice.
create table if not exists billing_events (
  reference text primary key,
  seller_id text not null references sellers(id),
  plan text not null,
  amount_kobo bigint not null,
  created_at timestamptz not null default now()
);

create table if not exists push_tokens (
  token text primary key,
  seller_id text not null references sellers(id),
  created_at timestamptz not null default now()
);
create index if not exists push_tokens_seller on push_tokens(seller_id);

-- Seller profile: photo (small image stored as a data URL) and buyer likes. A visitor is an anonymous id kept in the buyer's browser.
alter table sellers add column if not exists photo text;
create table if not exists seller_likes (
  seller_id text not null references sellers(id),
  visitor text not null,
  created_at timestamptz not null default now(),
  primary key (seller_id, visitor)
);

-- The bell inbox: every alert the seller was sent, kept so it can be read later in the app.
-- Alert choices. Payment found is on unless switched off; "link expired unpaid" is off unless switched on.
alter table sellers add column if not exists notify_detected boolean not null default true;
alter table sellers add column if not exists notify_expired boolean not null default false;

create table if not exists notifications (
  id text primary key,
  seller_id text not null references sellers(id),
  type text not null,
  title text not null,
  body text not null,
  invoice_id text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists notifications_seller on notifications(seller_id, created_at desc);

create table if not exists sessions (
  token_hash text primary key,
  contact text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
`;

type Runner = { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }> };

function wrap(runner: Runner, transaction: Db['transaction'], close: () => Promise<void>): Db {
  return {
    async query<T>(sql: string, params?: unknown[]) {
      return (await runner.query(sql, params)).rows as T[];
    },
    transaction,
    close,
  };
}

async function openPglite(dataDir: string): Promise<Db> {
  const pglite = dataDir ? new PGlite(dataDir) : new PGlite();
  await pglite.waitReady;
  await pglite.exec(SCHEMA);
  const make = (runner: Runner): Db =>
    wrap(runner, (fn) => pglite.transaction((tx) => fn(make(tx as unknown as Runner))), () => pglite.close());
  return make(pglite as unknown as Runner);
}

async function openPostgres(url: string): Promise<Db> {
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  await pool.query(SCHEMA);
  const make = (runner: Runner, inTx: boolean): Db =>
    wrap(
      runner,
      async (fn) => {
        if (inTx) return fn(make(runner, true));
        const client = await pool.connect();
        try {
          await client.query('begin');
          const out = await fn(make(client, true));
          await client.query('commit');
          return out;
        } catch (e) {
          await client.query('rollback').catch(() => undefined);
          throw e;
        } finally {
          client.release();
        }
      },
      () => pool.end(),
    );
  return make(pool, false);
}

export async function openDb(dataDir: string, databaseUrl?: string): Promise<Db> {
  return databaseUrl ? openPostgres(databaseUrl) : openPglite(dataDir);
}

/** Postgres error code for "unique constraint violated". */
export const isUniqueViolation = (e: unknown): boolean => (e as { code?: string })?.code === '23505';

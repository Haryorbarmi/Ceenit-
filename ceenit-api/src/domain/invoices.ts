import { randomInt } from 'node:crypto';
import { isUniqueViolation } from '../db';
import { centsToMicro, formatUsdt, MICRO, parseUsdt } from '../money';
import { AppError, Ctx } from './context';

export const EXPIRY_OPTIONS = [15, 30, 120, 1440] as const;

const INVOICE_COLS = `id, seller_id, wallet_address, item, buyer_reference, base_micro::text as base_micro, cents,
  amount_micro::text as amount_micro, status, expiry_minutes, expires_at, created_at, paid_at, parent_id, next_id, request_count`;

export type InvoiceRow = {
  id: string;
  seller_id: string;
  wallet_address: string;
  item: string;
  buyer_reference: string;
  base_micro: string;
  cents: number;
  amount_micro: string;
  status: string;
  expiry_minutes: number;
  expires_at: Date;
  created_at: Date;
  paid_at: Date | null;
  parent_id: string | null;
  next_id: string | null;
  request_count: number;
};

const SHORT_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // no look-alike letters (i, l, o, 0, 1)
export const newId = (len = 8): string => Array.from({ length: len }, () => SHORT_ALPHABET[randomInt(SHORT_ALPHABET.length)]).join('');

/** What the seller app sees. Amounts are decimal strings so nothing is ever rounded. */
export function toSellerView(r: InvoiceRow, baseUrl: string) {
  return {
    id: r.id,
    item: r.item,
    reference: r.buyer_reference,
    baseAmount: formatUsdt(BigInt(r.base_micro)),
    cents: r.cents,
    amount: formatUsdt(BigInt(r.amount_micro)),
    status: r.status,
    expiresAt: r.expires_at.toISOString(),
    createdAt: r.created_at.toISOString(),
    paidAt: r.paid_at?.toISOString() ?? null,
    nextId: r.next_id,
    requestCount: r.request_count,
    url: `${baseUrl}/pay/${r.id}`,
  };
}

export async function paidCount(ctx: Ctx, sellerId: string): Promise<number> {
  const [row] = await ctx.db.query<{ n: string }>(`select count(*)::text as n from invoices where seller_id = $1 and status = 'paid'`, [sellerId]);
  return Number(row?.n ?? 0);
}

async function pickCents(ctx: Ctx, wallet: string, baseMicro: bigint): Promise<number | null> {
  // A cents value stays reserved while the link is open and for the late-payment window after it expires.
  const used = await ctx.db.query<{ cents: number }>(
    `select cents from invoices
      where wallet_address = $1 and base_micro = $2::bigint
        and (status in ('pending', 'confirming') or expires_at + ($3::float8 * interval '1 millisecond') > now())`,
    [wallet, baseMicro.toString(), ctx.cfg.lateWindowMs],
  );
  const taken = new Set(used.map((u) => u.cents));
  const free = Array.from({ length: 99 }, (_, i) => i + 1).filter((c) => !taken.has(c));
  return free.length ? free[randomInt(free.length)]! : null;
}

export type CreateInvoiceInput = {
  sellerId: string;
  item: string;
  amount: string;
  reference?: string;
  expiryMinutes: number;
  /** The seller tapped "I understand, create link" on the disclaimer: a live link cannot be cancelled. */
  ack: boolean;
  parentId?: string;
};

export async function createInvoice(ctx: Ctx, input: CreateInvoiceInput): Promise<InvoiceRow> {
  if (!input.ack) throw new AppError('ack_required', 400, 'The seller must accept that a live link cannot be cancelled.');
  if (!(EXPIRY_OPTIONS as readonly number[]).includes(input.expiryMinutes)) throw new AppError('invalid_expiry', 400);
  const item = input.item.trim();
  if (item.length < 2 || item.length > 120) throw new AppError('invalid_item', 400);

  let baseMicro: bigint;
  try {
    baseMicro = parseUsdt(input.amount);
  } catch {
    throw new AppError('invalid_amount', 400, 'Enter an amount like 8000 or 1250.5');
  }
  if (baseMicro < MICRO) throw new AppError('amount_too_small', 400, 'The smallest link is 1 USDT.');
  if (baseMicro > 10_000_000n * MICRO) throw new AppError('amount_too_large', 400);

  const [seller] = await ctx.db.query<{ id: string; plan: string; plan_until: Date | null }>(`select id, plan, plan_until from sellers where id = $1`, [input.sellerId]);
  if (!seller) throw new AppError('seller_not_found', 404);
  // A paid plan that has run out (cancelled, or the card failed) makes the account read-only: old payments stay visible, new links wait for a renewal.
  if (seller.plan !== 'free' && seller.plan_until && seller.plan_until.getTime() < Date.now()) {
    throw new AppError('subscription_ended', 402, 'Your subscription has ended. Renew it to create new payment links.');
  }
  const [wallet] = await ctx.db.query<{ address: string }>(`select address from wallets where seller_id = $1 and active`, [input.sellerId]);
  if (!wallet) throw new AppError('no_wallet', 409, 'Add a wallet first.');

  // Free plan: 5 confirmed transactions for life. After that, a subscription is needed.
  if (seller.plan === 'free' && (await paidCount(ctx, seller.id)) >= ctx.cfg.freeTransactions) {
    throw new AppError('free_limit_reached', 402, 'You have used your 5 free transactions.');
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const cents = await pickCents(ctx, wallet.address, baseMicro);
    if (cents === null) throw new AppError('cents_exhausted', 409, 'You already have 99 open links for this amount. Wait for one to finish, or change the amount.');
    const amountMicro = baseMicro + centsToMicro(cents);
    const id = newId();
    try {
      const rows = await ctx.db.query<InvoiceRow>(
        `insert into invoices (id, seller_id, wallet_address, item, buyer_reference, base_micro, cents, amount_micro, status,
                               expiry_minutes, expires_at, parent_id, ack_no_cancel)
         values ($1, $2, $3, $4, $5, $6::bigint, $7, $8::bigint, 'pending', $9::int, now() + ($9::int * interval '1 minute'), $10, true)
         returning ${INVOICE_COLS}`,
        [id, seller.id, wallet.address, item, (input.reference ?? '').trim().slice(0, 80), baseMicro.toString(), cents, amountMicro.toString(), input.expiryMinutes, input.parentId ?? null],
      );
      return rows[0]!;
    } catch (e) {
      if (isUniqueViolation(e)) continue; // another link took that exact amount a moment ago: pick again
      throw e;
    }
  }
  throw new AppError('could_not_create', 503, 'Please try again.');
}

export async function listInvoices(ctx: Ctx, sellerId: string): Promise<InvoiceRow[]> {
  return ctx.db.query<InvoiceRow>(`select ${INVOICE_COLS} from invoices where seller_id = $1 order by created_at desc limit 200`, [sellerId]);
}

export async function getSellerInvoice(ctx: Ctx, sellerId: string, id: string): Promise<InvoiceRow> {
  const [row] = await ctx.db.query<InvoiceRow>(`select ${INVOICE_COLS} from invoices where id = $1 and seller_id = $2`, [id, sellerId]);
  if (!row) throw new AppError('not_found', 404);
  return row;
}

export { INVOICE_COLS };

// Settings read from the environment, with safe defaults for local work.

export type Network = 'fake' | 'nile' | 'mainnet';

// Official USDT contracts. Payments in any other token are rejected.
// mainnet: confirmed against the live TronGrid API.
// nile (test network): the coin the Nile faucet hands out, confirmed from a real faucet payment on 2026-10-27.
const USDT: Record<Network, string> = {
  mainnet: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  nile: 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf',
  fake: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
};

const HOSTS: Record<Network, string> = {
  mainnet: 'https://api.trongrid.io',
  nile: 'https://nile.trongrid.io',
  fake: '',
};

export type Config = {
  port: number;
  network: Network;
  tronHost: string;
  tronApiKey?: string;
  usdtContract: string;
  /** Poll the chain this often. */
  pollMs: number;
  /** After a link expires, a payment of the exact amount is still flagged for the seller for this long. */
  lateWindowMs: number;
  /** Confirmations shown to the buyer. The payment counts as confirmed when TRON marks its block final. */
  confirmationsShown: number;
  /** Where the database lives. Empty means memory only (used by tests). */
  dataDir: string;
  /** Hosted Postgres (Neon). When set, it is used instead of the built-in test database. */
  databaseUrl?: string;
  /** Development only: include the login code in the response so no WhatsApp provider is needed. */
  devReturnCode: boolean;
  /** Free plan allowance: confirmed transactions for life. */
  freeTransactions: number;
  /** Base address of the buyer web pages. Payment links are built from it, for example https://ceenit.app */
  publicBaseUrl: string;
  /** Browser origins allowed to call this API. "*" is only for development. */
  corsOrigin: string;
  /** Paystack secret key (sk_test_… while testing). Without it, subscriptions are switched off. */
  paystackSecret?: string;
  /** Paystack plan codes, created once by `npm run paystack:setup`. */
  planCodes: { seller?: string; business?: string };
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const network = (env.NETWORK ?? 'fake') as Network;
  if (!(network in USDT)) throw new Error(`NETWORK must be fake, nile or mainnet (got ${network})`);
  const isProd = env.NODE_ENV === 'production';
  return {
    port: Number(env.PORT ?? 4000),
    network,
    tronHost: env.TRON_HOST ?? HOSTS[network],
    tronApiKey: env.TRONGRID_API_KEY,
    usdtContract: env.USDT_CONTRACT ?? USDT[network],
    pollMs: Number(env.POLL_MS ?? 4000),
    lateWindowMs: Number(env.LATE_WINDOW_HOURS ?? 24) * 3_600_000,
    confirmationsShown: 20,
    dataDir: env.DATA_DIR ?? (isProd ? '' : './data'),
    databaseUrl: env.DATABASE_URL || undefined,
    devReturnCode: !isProd && env.DEV_RETURN_CODE !== '0',
    freeTransactions: 5,
    publicBaseUrl: env.PUBLIC_BASE_URL ?? 'http://localhost:3000',
    corsOrigin: env.CORS_ORIGIN ?? (isProd ? '' : '*'),
    paystackSecret: env.PAYSTACK_SECRET_KEY || undefined,
    planCodes: { seller: env.PAYSTACK_PLAN_SELLER || undefined, business: env.PAYSTACK_PLAN_BUSINESS || undefined },
  };
}

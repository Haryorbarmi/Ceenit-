# Ceeneet API

The backend: accounts, payment links, and the blockchain watcher that confirms USDT payments on TRON.
TypeScript, Fastify, Postgres (PGlite in development).

## Run it

    npm install
    npm run dev          # http://localhost:4000, pretend TRON network, data kept in ./data
    npm test             # 38 tests: payment checks, matching, cents rule, login, full journeys
    npx tsx scripts/live-smoke.ts   # read-only check of the watcher against real TRON mainnet

## Networks (NETWORK=...)

| Value | What it does |
|---|---|
| `fake` (default) | A pretend chain. Dev-only endpoints under `/dev` can pay, mine blocks and expire links. |
| `nile` | The TRON test network with free test USDT. Needs `TRONGRID_API_KEY` recommended. |
| `mainnet` | Real money. Needs `TRONGRID_API_KEY`. Do not use until the security items below are done. |

Other settings: `PORT`, `POLL_MS`, `LATE_WINDOW_HOURS`, `PUBLIC_BASE_URL`, `CORS_ORIGIN`, `DATA_DIR`, `USDT_CONTRACT`, `TRON_HOST`.

## How a payment is confirmed

The watcher (`src/watcher/watcher.ts`) checks every wallet that has an open link. For each new transfer it reads the
transaction itself, finds the invoice it belongs to, and records it. When TRON marks the transaction's block final it runs
the six checks (`src/domain/verify.ts`): real USDT, right wallet, exact amount, successful, confirmed, used once.
Only then is the link marked Paid. Payments that do not fit (late, too little, too much) are flagged for the seller.

## Still to do before real money

- Rate limiting on the public endpoints
- Real login code delivery (WhatsApp Business API, email) and push notifications
- Wallet change flow (PIN, code, 24-hour wait)
- Swap PGlite for a hosted Postgres (`src/db/index.ts` is the only file that changes)
- Subscriptions with Paystack
- Hosting over https, backups, monitoring, and a TronGrid API key

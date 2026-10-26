// Read-only check of the watcher against the REAL TRON mainnet. No keys, no money, no writes to the chain.
// It takes a real USDT transfer that already happened, makes an invoice that matches it exactly,
// and checks the watcher finds it, runs the six checks and marks the invoice Paid.
//   npx tsx scripts/live-smoke.ts
import { loadConfig } from '../src/config';
import { openDb } from '../src/db';
import { Ctx } from '../src/domain/context';
import { Watcher } from '../src/watcher/watcher';
import { TronGridClient } from '../src/tron/trongrid';
import { formatUsdt } from '../src/money';

const cfg = loadConfig({ NETWORK: 'mainnet', DATA_DIR: '', NODE_ENV: 'test', TRONGRID_API_KEY: process.env.TRONGRID_API_KEY } as NodeJS.ProcessEnv);
const tron = new TronGridClient(cfg.tronHost, cfg.usdtContract, cfg.tronApiKey);

// A busy wallet: the USDT contract's own address receives plenty of small transfers.
const WALLET = cfg.usdtContract;
const since = Date.now() - 6 * 3_600_000;
const transfers = (await tron.listIncomingTransfers(WALLET, since)).filter((t) => t.amountMicro >= 1_000_000n);
console.log(`listed ${transfers.length} transfers of 1 USDT or more in the last 6 hours`);
const t = transfers.at(-1);
if (!t) throw new Error('no transfer found to test with; try again later');
console.log('using tx', t.txId, formatUsdt(t.amountMicro), 'USDT at', new Date(t.blockTimeMs).toISOString());

const info = await tron.getTxInfo(t.txId);
const blocks = await tron.getBlocks();
console.log('tx block', info?.blockNumber, 'success', info?.success, 'logs', info?.logs.length, '| chain', blocks);

const db = await openDb('');
await db.query(`insert into sellers (id, slug, full_name, shop_name, category, city, contact, contact_method) values ('s1','smoke','A B','Smoke','Cars','Lagos','2340000000001','phone')`);
await db.query(`insert into wallets (id, seller_id, address) values ('w1','s1',$1)`, [WALLET]);
// base + cents = exactly the real amount. Window opens before the real transfer and is still open now.
const cents = Number((t.amountMicro % 1_000_000n) / 10_000n);
const base = t.amountMicro - BigInt(cents) * 10_000n;
await db.query(
  `insert into invoices (id, seller_id, wallet_address, item, base_micro, cents, amount_micro, status, expiry_minutes, expires_at, created_at, ack_no_cancel)
   values ('inv1','s1',$1,'Real transfer',$2::bigint,$3,$4::bigint,'pending',30, now() + interval '30 minutes', $5::timestamptz, true)`,
  [WALLET, base.toString(), Math.max(1, cents), t.amountMicro.toString(), new Date(t.blockTimeMs - 600_000).toISOString()],
);
const ctx: Ctx = { db, cfg, tron, notifier: { notify: async (e) => void console.log('notify:', e.type, e.detail ?? '') }, sendCode: async () => {} };
const w = new Watcher(ctx);
await w.tick();
console.log('after pass 1:', (await db.query(`select status from invoices where id='inv1'`))[0]);
await w.tick();
const [p] = await db.query(`select outcome, confirmations, confirmed, success, checks from payments`);
console.log('payment:', JSON.stringify(p));
console.log('final invoice:', (await db.query(`select status, paid_at is not null as has_paid_at from invoices where id='inv1'`))[0]);
await db.close();

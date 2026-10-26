import { loadConfig } from './config';
import { openDb } from './db';
import { consoleCodeSender, consoleNotifier, Ctx } from './domain/context';
import { buildServer } from './http/server';
import { FakeTron } from './tron/fake';
import { TronGridClient } from './tron/trongrid';
import type { TronClient } from './tron/types';
import { Watcher } from './watcher/watcher';

const cfg = loadConfig();
const db = await openDb(cfg.dataDir, cfg.databaseUrl);

// NETWORK=fake  a pretend chain, for building and testing with no real money (the default)
// NETWORK=nile  the TRON test network, with free test USDT
// NETWORK=mainnet  the real thing
const fake = cfg.network === 'fake' ? new FakeTron(cfg.usdtContract) : undefined;
const tron: TronClient = fake ?? new TronGridClient(cfg.tronHost, cfg.usdtContract, cfg.tronApiKey);

const ctx: Ctx = { db, cfg, tron, notifier: consoleNotifier, sendCode: consoleCodeSender };
const watcher = new Watcher(ctx);
const app = buildServer(ctx, { fake });

await app.listen({ port: cfg.port, host: '0.0.0.0' });
watcher.start();
console.log(`Ceenit API on http://0.0.0.0:${cfg.port}  network=${cfg.network}  usdt=${cfg.usdtContract}`);

const shutdown = async () => {
  watcher.stop();
  await app.close();
  await db.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Connects to DATABASE_URL, creates the tables, writes one test seller and removes it. Run: npm run db:check
import { loadConfig } from '../src/config';
import { openDb } from '../src/db';

const cfg = loadConfig();
if (!cfg.databaseUrl) throw new Error('DATABASE_URL is not set in .env');
const db = await openDb('', cfg.databaseUrl);
const [{ now }] = await db.query<{ now: Date }>('select now() as now');
const tables = await db.query<{ table_name: string }>("select table_name from information_schema.tables where table_schema = 'public' order by 1");
await db.transaction(async (tx) => {
  await tx.query("insert into sellers (id, slug, full_name, shop_name, category, city, contact, contact_method) values ('dbcheck', 'dbcheck', 'Check', 'Check', 'Cars', 'Lagos', 'dbcheck', 'phone')");
  const [row] = await tx.query<{ slug: string }>("select slug from sellers where id = 'dbcheck'");
  if (row.slug !== 'dbcheck') throw new Error('read back failed');
  await tx.query("delete from sellers where id = 'dbcheck'");
});
console.log('connected at', now.toISOString());
console.log('tables:', tables.map((t) => t.table_name).join(', '));
console.log('write, read and delete inside a transaction: ok');
await db.close();

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadConfig } from './config';
import { openDb } from './db';
import { Ctx, NotifyEvent } from './domain/context';
import { createInvoice } from './domain/invoices';
import { contactForToken, listSessions, registerSeller, requestCode, revokeSession, verifyCode } from './domain/sellers';
import { applyDueWalletChanges, cancelWalletChange, pendingWalletChange, requestWalletChange } from './domain/wallet';
import { hex20ToAddress } from './tron/address';
import { FakeTron } from './tron/fake';

let n = 1200;
async function setup() {
  const cfg = loadConfig({ NETWORK: 'fake', NODE_ENV: 'test' } as NodeJS.ProcessEnv);
  const db = await openDb('');
  const events: NotifyEvent[] = [];
  const ctx: Ctx = { db, cfg, tron: new FakeTron(cfg.usdtContract), notifier: { notify: async (e) => void events.push(e) }, sendCode: async () => undefined };
  const i = n++;
  const wallet = hex20ToAddress(i.toString(16).padStart(40, '0'));
  const seller = (await registerSeller(ctx, {
    contact: `2348077${String(i).padStart(5, '0')}`, method: 'phone', fullName: 'Test Seller', shopName: `Sec ${i}`, category: 'Cars', city: 'Lagos', linkName: `sec-${i}`, wallet,
  }))!;
  await ctx.db.query(`update sellers set plan = 'seller' where id = $1`, [seller.id]);
  const login = async (device: string) => {
    const { devCode } = await requestCode(ctx, 'phone', seller.contact);
    return (await verifyCode(ctx, 'phone', seller.contact, devCode!, device)).token;
  };
  const code = async () => (await requestCode(ctx, 'phone', seller.contact)).devCode!;
  return { ctx, seller, events, login, code, wallet };
}
const other = (k: number) => hex20ToAddress((900_000 + k).toString(16).padStart(40, '0'));

describe('devices', () => {
  it('lists logins with the device name, marks this one, alerts on a second login, and logs one out', async () => {
    const { ctx, seller, events, login } = await setup();
    const phone = await login('iPhone 11');
    assert.equal(events.filter((e) => e.type === 'new_device').length, 0); // first login is not "new"
    const laptop = await login('Chrome on Mac');
    assert.deepEqual(events.filter((e) => e.type === 'new_device').map((e) => e.detail), ['Chrome on Mac']);

    const list = await listSessions(ctx, seller.contact, phone);
    assert.deepEqual(list.map((d) => [d.device, d.current]).sort(), [['Chrome on Mac', false], ['iPhone 11', true]]);

    await revokeSession(ctx, seller.contact, list.find((d) => !d.current)!.id);
    assert.equal(await contactForToken(ctx, laptop), null);
    assert.equal(await contactForToken(ctx, phone), seller.contact);
  });

  it('cannot log out another account\'s device', async () => {
    const a = await setup();
    const b = await setup();
    const tokenB = await b.login('B phone');
    const idB = (await listSessions(b.ctx, b.seller.contact, tokenB))[0]!.id;
    await revokeSession(a.ctx, a.seller.contact, idB); // wrong account: nothing happens
    assert.equal(await contactForToken(b.ctx, tokenB), b.seller.contact);
  });
});

describe('wallet change', () => {
  it('needs the right code, waits, can be cancelled, and old links keep the old wallet', async () => {
    const { ctx, seller, events, code, wallet } = await setup();
    const me = { id: seller.id, contact: seller.contact, wallet };

    await code();
    await assert.rejects(requestWalletChange(ctx, me, other(1), '000000'), { code: 'wrong_code' });

    const first = await requestWalletChange(ctx, me, other(1), await code());
    assert.equal(first.address, other(1));
    assert.ok(new Date(first.startsAt).getTime() - Date.now() > 23 * 3_600_000);
    assert.equal(events.at(-1)!.type, 'wallet_change_requested');
    await assert.rejects(requestWalletChange(ctx, me, other(2), await code()), { code: 'change_pending' });

    await cancelWalletChange(ctx, seller.id);
    assert.equal(await pendingWalletChange(ctx, seller.id), null);

    const oldLink = await createInvoice(ctx, { sellerId: seller.id, item: 'Before change', amount: '10', expiryMinutes: 30, ack: true });
    await requestWalletChange(ctx, me, other(1), await code());
    await ctx.db.query(`update wallet_changes set starts_at = now() - interval '1 minute' where seller_id = $1 and status = 'pending'`, [seller.id]);
    await applyDueWalletChanges(ctx);

    const [active] = await ctx.db.query<{ address: string }>(`select address from wallets where seller_id = $1 and active`, [seller.id]);
    assert.equal(active!.address, other(1));
    assert.equal(events.at(-1)!.type, 'wallet_changed');
    const newLink = await createInvoice(ctx, { sellerId: seller.id, item: 'After change', amount: '10', expiryMinutes: 30, ack: true });
    assert.equal(oldLink.wallet_address, wallet);
    assert.equal(newLink.wallet_address, other(1));
  });

  it('rejects a bad address, the same wallet, and a wallet that belongs to someone else', async () => {
    const a = await setup();
    const b = await setup();
    const me = { id: a.seller.id, contact: a.seller.contact, wallet: a.wallet };
    await assert.rejects(requestWalletChange(a.ctx, me, 'T' + 'x'.repeat(33), await a.code()), { code: 'invalid_wallet' });
    await assert.rejects(requestWalletChange(a.ctx, me, a.wallet, await a.code()), { code: 'same_wallet' });
    // Same database is not shared between setups, so put b's wallet into a's database to check the rule.
    await a.ctx.db.query(`insert into sellers (id, slug, full_name, shop_name, category, city, contact, contact_method) values ('zz', 'zz', 'Z', 'Z', 'Cars', 'L', 'zz', 'phone')`);
    await a.ctx.db.query(`insert into wallets (id, seller_id, address) values ('zzw', 'zz', $1)`, [b.wallet]);
    await assert.rejects(requestWalletChange(a.ctx, me, b.wallet, await a.code()), { code: 'wallet_in_use' });
  });
});

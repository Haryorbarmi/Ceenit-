import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { openDb } from './db';
import { compose, PushMessage, PushNotifier } from './domain/push';

async function setup() {
  const db = await openDb('');
  await db.query(`insert into sellers (id, slug, full_name, shop_name, category, city, contact, contact_method) values ('s1', 's1', 'A', 'A', 'Cars', 'Lagos', 'c1', 'phone')`);
  await db.query(`insert into invoices (id, seller_id, wallet_address, item, base_micro, cents, amount_micro, status, expiry_minutes, expires_at, ack_no_cancel)
                  values ('inv1', 's1', 'Twallet', 'Toyota Camry', 8000000000, 37, 8000370000, 'pending', 30, now() + interval '30 minutes', true)`);
  const sent: PushMessage[] = [];
  return { db, sent };
}

describe('phone alerts', () => {
  it('sends a clear message to every phone registered for the seller', async () => {
    const { db, sent } = await setup();
    await db.query(`insert into push_tokens (token, seller_id) values ('ExponentPushToken[aaaaaaaaaaaa]', 's1'), ('ExponentPushToken[bbbbbbbbbbbb]', 's1')`);
    const n = new PushNotifier(db, async (m) => { sent.push(...m); return m.map(() => ({ status: 'ok' as const })); });
    await n.notify({ type: 'payment_confirmed', sellerId: 's1', invoiceId: 'inv1', detail: '8,000.37 USDT' });
    assert.equal(sent.length, 2);
    assert.equal(sent[0]!.title, 'You have been paid');
    assert.match(sent[0]!.body, /8,000\.37 USDT for Toyota Camry is confirmed/);
    assert.deepEqual(sent[0]!.data, { type: 'payment_confirmed', invoiceId: 'inv1' });
  });

  it('does nothing for a seller with no registered phone, and never throws', async () => {
    const { db } = await setup();
    let calls = 0;
    const n = new PushNotifier(db, async () => { calls++; return []; });
    await n.notify({ type: 'link_requested', sellerId: 's1', detail: 'Ada' });
    assert.equal(calls, 0);
    const broken = new PushNotifier(db, async () => { throw new Error('offline'); });
    await db.query(`insert into push_tokens (token, seller_id) values ('ExponentPushToken[cccccccccccc]', 's1')`);
    await broken.notify({ type: 'link_requested', sellerId: 's1', detail: 'Ada' });
  });

  it('forgets a phone that Expo says is no longer registered', async () => {
    const { db } = await setup();
    await db.query(`insert into push_tokens (token, seller_id) values ('ExponentPushToken[dead00000000]', 's1')`);
    const n = new PushNotifier(db, async () => [{ status: 'error', details: { error: 'DeviceNotRegistered' } }]);
    await n.notify({ type: 'payment_detected', sellerId: 's1', invoiceId: 'inv1', detail: '1.00 USDT' });
    assert.equal((await db.query(`select 1 from push_tokens`)).length, 0);
  });

  it('words each kind of event for the lock screen', () => {
    assert.match(compose({ type: 'payment_flagged', sellerId: 's', detail: 'late: 1,150.42 USDT' }, 'MacBook').body, /1,150\.42 USDT for MacBook came in after the link expired/);
    assert.equal(compose({ type: 'link_requested', sellerId: 's', detail: 'Ada' }).title, 'New link request');
  });
});

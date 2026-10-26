import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { loadConfig } from './config';
import { openDb } from './db';
import { Ctx, NotifyEvent } from './domain/context';
import { createInvoice, getSellerInvoice, listInvoices, newId } from './domain/invoices';
import { approveRequest, publicInvoice, requestNewLink, resolvePayment } from './domain/links';
import { registerSeller, requestCode, verifyCode } from './domain/sellers';
import { buildServer } from './http/server';
import { parseUsdt } from './money';
import { hex20ToAddress } from './tron/address';
import { FakeTron } from './tron/fake';
import { Watcher } from './watcher/watcher';

// A valid TRON address for any number, so every test seller gets its own wallet.
const wallet = (n: number) => hex20ToAddress(n.toString(16).padStart(40, '0'));
const BUYER = wallet(9999);

let counter = 1;
async function setup() {
  const cfg = loadConfig({ NETWORK: 'fake', DATA_DIR: '', NODE_ENV: 'test' } as NodeJS.ProcessEnv);
  const db = await openDb('');
  const tron = new FakeTron(cfg.usdtContract);
  const events: NotifyEvent[] = [];
  const codes: string[] = [];
  const ctx: Ctx = { db, cfg, tron, notifier: { notify: async (e) => void events.push(e) }, sendCode: async (_c, _m, code) => void codes.push(code) };
  const watcher = new Watcher(ctx);
  return { ctx, tron, watcher, events, codes, cfg };
}
type Env = Awaited<ReturnType<typeof setup>>;

async function seller(env: Env) {
  const n = counter++;
  const s = await registerSeller(env.ctx, {
    contact: `23480000${String(n).padStart(4, '0')}`,
    method: 'phone',
    fullName: 'Emeka Okafor',
    shopName: `Shop ${n}`,
    category: 'Cars',
    city: 'Lagos',
    linkName: `shop-${n}`,
    wallet: wallet(n),
  });
  return s!;
}

const link = (env: Env, sellerId: string, amount = '8000', expiryMinutes = 30) =>
  createInvoice(env.ctx, { sellerId, item: 'Toyota Camry 2015', amount, expiryMinutes, ack: true });

/** Matches an AppError by its code, whatever its human message says. */
const code = (c: string) => (e: unknown) => (e as { code?: string }).code === c;

const statusOf = async (env: Env, id: string) => (await env.ctx.db.query<{ status: string }>(`select status from invoices where id = $1`, [id]))[0]!.status;

describe('a clean payment', () => {
  let env: Env;
  before(async () => (env = await setup()));

  it('goes waiting, then confirming, then Paid only once the block is final', async () => {
    const s = await seller(env);
    const inv = await link(env, s.id);
    assert.equal(inv.status, 'pending');
    assert.ok(inv.cents >= 1 && inv.cents <= 99);

    env.tron.sendUsdt({ from: BUYER, to: s.wallet, amountMicro: BigInt(inv.amount_micro) });
    await env.watcher.tick();
    assert.equal(await statusOf(env, inv.id), 'confirming');
    assert.equal((await publicInvoice(env.ctx, inv.id)).status, 'confirming');

    env.tron.mine(5); // some confirmations, but the block is not final yet
    await env.watcher.tick();
    assert.equal(await statusOf(env, inv.id), 'confirming');
    const mid = await publicInvoice(env.ctx, inv.id);
    assert.ok(mid.confirmationsDone > 1 && mid.confirmationsDone < 20);

    env.tron.mine(20);
    await env.watcher.tick();
    assert.equal(await statusOf(env, inv.id), 'paid');
    const done = await publicInvoice(env.ctx, inv.id);
    assert.equal(done.status, 'paid');
    assert.equal(done.confirmationsDone, 20);
    assert.ok(done.txId);
    assert.deepEqual(env.events.filter((e) => e.invoiceId === inv.id).map((e) => e.type), ['payment_detected', 'payment_confirmed']);

    const [pay] = await env.ctx.db.query<{ checks: Record<string, boolean> }>(`select checks from payments where invoice_id = $1`, [inv.id]);
    assert.deepEqual(Object.values(pay!.checks), [true, true, true, true, true, true]);
  });

  it('records a transaction only once, even if the watcher sees it again', async () => {
    const s = await seller(env);
    const inv = await link(env, s.id, '500');
    env.tron.sendUsdt({ from: BUYER, to: s.wallet, amountMicro: BigInt(inv.amount_micro) });
    await env.watcher.tick();
    await env.watcher.tick();
    await env.watcher.tick();
    const rows = await env.ctx.db.query(`select 1 from payments where invoice_id = $1`, [inv.id]);
    assert.equal(rows.length, 1);
  });
});

describe('payments that must not count', () => {
  let env: Env;
  before(async () => (env = await setup()));

  it('a fake token with the right amount is rejected', async () => {
    const s = await seller(env);
    const inv = await link(env, s.id);
    env.tron.sendUsdt({ from: BUYER, to: s.wallet, amountMicro: BigInt(inv.amount_micro), contract: wallet(7777) });
    env.tron.mine(25);
    await env.watcher.tick();
    await env.watcher.tick();
    assert.equal(await statusOf(env, inv.id), 'pending');
    const [p] = await env.ctx.db.query<{ outcome: string }>(`select outcome from payments where wallet_address = $1`, [s.wallet]);
    assert.equal(p!.outcome, 'rejected');
  });

  it('a failed transaction moves no money and does not pay the link', async () => {
    const s = await seller(env);
    const inv = await link(env, s.id);
    env.tron.sendUsdt({ from: BUYER, to: s.wallet, amountMicro: BigInt(inv.amount_micro), success: false });
    env.tron.mine(25);
    await env.watcher.tick();
    assert.equal(await statusOf(env, inv.id), 'pending');
  });

  it('a payment to a different wallet is ignored', async () => {
    const s = await seller(env);
    const other = await seller(env);
    const inv = await link(env, s.id);
    env.tron.sendUsdt({ from: BUYER, to: other.wallet, amountMicro: BigInt(inv.amount_micro) });
    env.tron.mine(25);
    await env.watcher.tick();
    assert.equal(await statusOf(env, inv.id), 'pending');
  });
});

describe('payments that need the seller to decide', () => {
  let env: Env;
  before(async () => (env = await setup()));

  it('underpaid: flagged, and only becomes Paid when the seller accepts it after confirmation', async () => {
    const s = await seller(env);
    const inv = await link(env, s.id, '1250');
    const short = BigInt(inv.amount_micro) - parseUsdt('50.18');
    const tx = env.tron.sendUsdt({ from: BUYER, to: s.wallet, amountMicro: short });
    await env.watcher.tick();
    assert.equal(await statusOf(env, inv.id), 'underpaid');
    const view = await publicInvoice(env.ctx, inv.id);
    assert.equal(view.status, 'underpaid');
    assert.ok(env.events.some((e) => e.type === 'payment_flagged' && e.invoiceId === inv.id));

    await assert.rejects(resolvePayment(env.ctx, s.id, tx), code('not_confirmed')); // too early
    env.tron.mine(25);
    await env.watcher.tick();
    await resolvePayment(env.ctx, s.id, tx);
    assert.equal(await statusOf(env, inv.id), 'paid');
  });

  it('overpaid: flagged', async () => {
    const s = await seller(env);
    const inv = await link(env, s.id, '640');
    env.tron.sendUsdt({ from: BUYER, to: s.wallet, amountMicro: BigInt(inv.amount_micro) + parseUsdt('14.36') });
    await env.watcher.tick();
    assert.equal(await statusOf(env, inv.id), 'overpaid');
  });

  it('late: exact amount after expiry is flagged, never marked Paid on its own', async () => {
    const s = await seller(env);
    const inv = await link(env, s.id, '1150');
    await env.ctx.db.query(`update invoices set expires_at = now() - interval '3 minutes', created_at = now() - interval '33 minutes' where id = $1`, [inv.id]);
    await env.watcher.tick(); // sweeps it to expired
    assert.equal(await statusOf(env, inv.id), 'expired');
    env.tron.sendUsdt({ from: BUYER, to: s.wallet, amountMicro: BigInt(inv.amount_micro) });
    env.tron.mine(25);
    await env.watcher.tick();
    await env.watcher.tick();
    assert.equal(await statusOf(env, inv.id), 'late');
    assert.equal((await publicInvoice(env.ctx, inv.id)).status, 'late');
  });

  it('unmatched: an amount that fits no link is recorded and the seller is told', async () => {
    const s = await seller(env);
    const a = await link(env, s.id, '100');
    const b = await link(env, s.id, '300');
    env.tron.sendUsdt({ from: BUYER, to: s.wallet, amountMicro: parseUsdt('7777') });
    await env.watcher.tick();
    assert.equal(await statusOf(env, a.id), 'pending');
    assert.equal(await statusOf(env, b.id), 'pending');
    assert.ok(env.events.some((e) => e.type === 'payment_unmatched' && e.sellerId === s.id));
  });
});

describe('the unique cents rule', () => {
  let env: Env;
  before(async () => (env = await setup()));

  it('gives 99 open links of one amount different cents, then says no more', async () => {
    const s = await seller(env);
    const seen = new Set<number>();
    for (let i = 0; i < 99; i++) seen.add((await link(env, s.id, '8000')).cents);
    assert.equal(seen.size, 99);
    await assert.rejects(link(env, s.id, '8000'), code('cents_exhausted'));
    // A different price is unaffected.
    assert.ok(await link(env, s.id, '8001'));
  });

  it('keeps cents reserved for the late window after a link expires', async () => {
    const s = await seller(env);
    const first = await link(env, s.id, '250');
    await env.ctx.db.query(`update invoices set status = 'expired', expires_at = now() - interval '1 hour' where id = $1`, [first.id]);
    const seen = new Set<number>([first.cents]);
    for (let i = 0; i < 98; i++) seen.add((await link(env, s.id, '250')).cents);
    assert.equal(seen.size, 99); // the expired link's cents were not reused
  });
});

describe('plan and link rules', () => {
  let env: Env;
  before(async () => (env = await setup()));

  it('a link cannot be created without accepting that it cannot be cancelled', async () => {
    const s = await seller(env);
    await assert.rejects(createInvoice(env.ctx, { sellerId: s.id, item: 'Phone', amount: '100', expiryMinutes: 30, ack: false }), code('ack_required'));
  });

  it('blocks new links after 5 confirmed transactions on the free plan', async () => {
    const s = await seller(env);
    for (let i = 0; i < 5; i++) {
      const inv = await link(env, s.id, String(100 + i));
      await env.ctx.db.query(`update invoices set status = 'paid' where id = $1`, [inv.id]);
    }
    await assert.rejects(link(env, s.id, '999'), code('free_limit_reached'));
    await env.ctx.db.query(`update sellers set plan = 'seller' where id = $1`, [s.id]);
    assert.ok(await link(env, s.id, '999')); // subscribing lifts the limit
  });

  it('rejects bad amounts and expiry choices', async () => {
    const s = await seller(env);
    await assert.rejects(link(env, s.id, '0.5'), code('amount_too_small'));
    await assert.rejects(link(env, s.id, 'abc'), code('invalid_amount'));
    await assert.rejects(link(env, s.id, '100', 45), code('invalid_expiry'));
  });

  it('only a valid TRON address can be a wallet, and link names are unique', async () => {
    const base = { contact: '2348099990001', method: 'phone' as const, fullName: 'A B', shopName: 'S', category: 'Cars', city: 'Lagos' };
    await assert.rejects(registerSeller(env.ctx, { ...base, linkName: 'bad-wallet', wallet: 'T' + 'a'.repeat(33) }), code('invalid_wallet'));
    await assert.rejects(registerSeller(env.ctx, { ...base, linkName: 'admin', wallet: wallet(5001) }), code('invalid_link_name'));
    await registerSeller(env.ctx, { ...base, linkName: 'taken-name', wallet: wallet(5002) });
    await assert.rejects(registerSeller(env.ctx, { ...base, contact: '2348099990002', linkName: 'taken-name', wallet: wallet(5003) }), code('link_name_taken'));
  });
});

describe('asking for a new link', () => {
  let env: Env;
  before(async () => (env = await setup()));

  const expire = (id: string) => env.ctx.db.query(`update invoices set status = 'expired', expires_at = now() - interval '1 minute' where id = $1`, [id]);

  it('a live link cannot be requested again', async () => {
    const s = await seller(env);
    const inv = await link(env, s.id);
    await assert.rejects(requestNewLink(env.ctx, inv.id, 'Ada'), code('not_expired'));
  });

  it('request, then the seller approves: a fresh link with new cents, the old one points to it', async () => {
    const s = await seller(env);
    const inv = await link(env, s.id, '1250');
    await expire(inv.id);
    await requestNewLink(env.ctx, inv.id, 'Ada Nwosu');
    await requestNewLink(env.ctx, inv.id, 'Ada Nwosu'); // repeat tap
    assert.equal((await publicInvoice(env.ctx, inv.id)).status, 'requested');
    assert.equal((await publicInvoice(env.ctx, inv.id)).requestCount, 1);
    assert.ok(env.events.some((e) => e.type === 'link_requested' && e.sellerId === s.id));

    const [q] = await env.ctx.db.query<{ id: string }>(`select id from link_requests where invoice_id = $1`, [inv.id]);
    const fresh = await approveRequest(env.ctx, s.id, q!.id, {});
    assert.equal(fresh.status, 'pending');
    assert.equal(fresh.parent_id, inv.id);
    assert.notEqual(fresh.id, inv.id);
    assert.equal((await publicInvoice(env.ctx, inv.id)).nextId, fresh.id);
    await assert.rejects(approveRequest(env.ctx, s.id, q!.id, {}), code('already_handled'));
  });

  it("another seller cannot approve someone else's request", async () => {
    const s = await seller(env);
    const stranger = await seller(env);
    const inv = await link(env, s.id);
    await expire(inv.id);
    await requestNewLink(env.ctx, inv.id, 'Ada');
    const [q] = await env.ctx.db.query<{ id: string }>(`select id from link_requests where invoice_id = $1`, [inv.id]);
    await assert.rejects(approveRequest(env.ctx, stranger.id, q!.id, {}), code('not_found'));
    await assert.rejects(getSellerInvoice(env.ctx, stranger.id, inv.id), code('not_found'));
  });

  it('stops after 3 requests', async () => {
    const s = await seller(env);
    const inv = await link(env, s.id);
    for (let i = 0; i < 3; i++) {
      await expire(inv.id);
      await requestNewLink(env.ctx, inv.id, 'Ada');
      await env.ctx.db.query(`update link_requests set status = 'declined' where invoice_id = $1`, [inv.id]);
    }
    await expire(inv.id);
    await assert.rejects(requestNewLink(env.ctx, inv.id, 'Ada'), code('limit'));
  });
});

describe('login', () => {
  let env: Env;
  before(async () => (env = await setup()));

  it('a right code gives a session; the code works once', async () => {
    const r = await requestCode(env.ctx, 'phone', '0801 234 5678');
    assert.match(r.devCode!, /^\d{6}$/);
    const session = await verifyCode(env.ctx, 'phone', '+234 801 234 5678', r.devCode!); // same number, written differently
    assert.equal(session.hasAccount, false);
    assert.match(session.token, /^[0-9a-f]{64}$/);
    await assert.rejects(verifyCode(env.ctx, 'phone', '08012345678', r.devCode!), code('code_expired'));
  });

  it('locks after 5 wrong tries', async () => {
    await requestCode(env.ctx, 'phone', '08022222222');
    for (let i = 0; i < 5; i++) await assert.rejects(verifyCode(env.ctx, 'phone', '08022222222', '000000'), code('wrong_code'));
    await assert.rejects(verifyCode(env.ctx, 'phone', '08022222222', '123456'), code('locked'));
  });

  it('limits code requests to 5 an hour', async () => {
    for (let i = 0; i < 5; i++) await requestCode(env.ctx, 'email', 'a@example.com');
    await assert.rejects(requestCode(env.ctx, 'email', 'a@example.com'), code('too_many_requests'));
  });
});

describe('over HTTP', () => {
  it('the whole journey: log in, set up, create a link, buyer pays, link turns Paid', async () => {
    const env = await setup();
    const app = buildServer(env.ctx, { fake: env.tron });
    const post = async (url: string, body: unknown, token?: string) =>
      app.inject({ method: 'POST', url, payload: body as object, headers: token ? { authorization: `Bearer ${token}` } : {} });
    const get = async (url: string, token?: string) => app.inject({ method: 'GET', url, headers: token ? { authorization: `Bearer ${token}` } : {} });

    assert.equal((await get('/v1/me')).statusCode, 401);

    const rc = (await post('/v1/auth/request-code', { method: 'phone', contact: '08031112222' })).json();
    const { token } = (await post('/v1/auth/verify-code', { method: 'phone', contact: '08031112222', code: rc.devCode })).json();
    assert.equal((await get('/v1/me', token)).statusCode, 403); // logged in, but no shop yet

    assert.equal((await get('/v1/link-names/emeka-autos')).json().available, true);
    const w = wallet(424242);
    const reg = await post('/v1/sellers', { method: 'phone', fullName: 'Emeka Okafor', shopName: 'Emeka Autos', category: 'Cars', city: 'Lagos', linkName: 'emeka-autos', wallet: w }, token);
    assert.equal(reg.statusCode, 201);
    assert.equal(reg.json().freeUsed, 0);
    assert.equal((await get('/v1/link-names/emeka-autos')).json().available, false);

    const noAck = await post('/v1/invoices', { item: 'Toyota Camry 2015', amount: '8000', expiryMinutes: 30, acknowledgedNoCancel: false }, token);
    assert.equal(noAck.statusCode, 400);
    assert.equal(noAck.json().error, 'ack_required');

    const created = await post('/v1/invoices', { item: 'Toyota Camry 2015', amount: '8000', expiryMinutes: 30, acknowledgedNoCancel: true }, token);
    assert.equal(created.statusCode, 201);
    const inv = created.json();
    assert.match(inv.amount, /^8000\.\d\d$/);
    assert.ok(inv.url.endsWith(`/pay/${inv.id}`));

    // The buyer opens the page, then pays the exact amount from their wallet.
    const pub = (await get(`/v1/public/invoices/${inv.id}`)).json();
    assert.equal(pub.status, 'waiting');
    assert.equal(pub.wallet, w);
    assert.equal(pub.seller.name, 'Emeka Autos');
    await post('/dev/simulate-payment', { to: w, amount: inv.amount });
    await env.watcher.tick();
    assert.equal((await get(`/v1/public/invoices/${inv.id}`)).json().status, 'confirming');
    await post('/dev/mine', { blocks: 25 });
    await env.watcher.tick();
    assert.equal((await get(`/v1/public/invoices/${inv.id}`)).json().status, 'paid');

    const detail = (await get(`/v1/invoices/${inv.id}`, token)).json();
    assert.equal(detail.payments.length, 1);
    assert.equal((await get('/v1/me', token)).json().freeUsed, 1);
    assert.equal((await listInvoices(env.ctx, detail.id ? (await get('/v1/me', token)).json().id : '')).length, 1);

    // There is no way to cancel a live link.
    assert.equal((await app.inject({ method: 'DELETE', url: `/v1/invoices/${inv.id}`, headers: { authorization: `Bearer ${token}` } })).statusCode, 404);
    assert.equal((await post(`/v1/invoices/${inv.id}/cancel`, {}, token)).statusCode, 404);

    // The buyer can only see their own link, and never any seller data.
    assert.equal((await get('/v1/public/invoices/nope1234')).statusCode, 404);
    assert.equal(JSON.stringify(pub).includes('contact'), false);
    await app.close();
  });

  it('newId makes short ids without look-alike characters', () => {
    for (let i = 0; i < 200; i++) assert.match(newId(8), /^[a-hjkmnp-z2-9]{8}$/);
  });
});

import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';
import { Paystack, webhookSignatureOk } from './billing/paystack';
import { loadConfig } from './config';
import { openDb } from './db';
import { cancelSubscription, confirmCheckout, handleWebhook, PLAN_PRICES, startCheckout } from './domain/billing';
import { Ctx } from './domain/context';
import { createInvoice } from './domain/invoices';
import { registerSeller } from './domain/sellers';
import { FakeTron } from './tron/fake';
import { hex20ToAddress } from './tron/address';

type Call = { method: string; path: string; body?: any };

// A pretend Paystack that records what it was asked and answers like the real one.
function fakePaystack(answers: Record<string, unknown>) {
  const calls: Call[] = [];
  const doFetch = (async (url: string, init: RequestInit) => {
    const path = url.replace('https://api.paystack.co', '');
    calls.push({ method: String(init.method), path, body: init.body ? JSON.parse(String(init.body)) : undefined });
    const key = Object.keys(answers).find((k) => path.startsWith(k));
    return new Response(JSON.stringify({ status: true, data: key ? answers[key] : {} }), { status: 200 });
  }) as unknown as typeof fetch;
  return { calls, paystack: new Paystack('sk_test_x', doFetch) };
}

let n = 500;
async function setup(answers: Record<string, unknown> = {}) {
  const cfg = loadConfig({ NETWORK: 'fake', NODE_ENV: 'test', PAYSTACK_SECRET_KEY: 'sk_test_x', PAYSTACK_PLAN_SELLER: 'PLN_s', PAYSTACK_PLAN_BUSINESS: 'PLN_b' } as NodeJS.ProcessEnv);
  const db = await openDb('');
  const fp = fakePaystack(answers);
  const ctx: Ctx = { db, cfg, tron: new FakeTron(cfg.usdtContract), notifier: { notify: async () => undefined }, sendCode: async () => undefined, paystack: fp.paystack };
  const i = n++;
  const seller = (await registerSeller(ctx, {
    contact: `2348055${String(i).padStart(5, '0')}`, method: 'phone', fullName: 'Test Seller', shopName: `Billing ${i}`, category: 'Cars', city: 'Lagos',
    linkName: `billing-${i}`, wallet: hex20ToAddress(i.toString(16).padStart(40, '0')),
  }))!;
  return { ctx, seller, calls: fp.calls };
}
const planRow = async (ctx: Ctx, id: string) => (await ctx.db.query<{ plan: string; plan_until: Date | null; sub_cancelled: boolean }>(`select plan, plan_until, sub_cancelled from sellers where id = $1`, [id]))[0]!;
const success = (sellerId: string, plan = 'seller', reference = 'ceenit_ref00000001') => ({
  status: 'success', reference, amount: PLAN_PRICES[plan as 'seller'], metadata: { sellerId, plan }, customer: { customer_code: 'CUS_1' },
});

describe('subscriptions', () => {
  it('starts checkout with the right plan, price and a reference', async () => {
    const { ctx, seller, calls } = await setup({ '/transaction/initialize': { authorization_url: 'https://checkout.paystack.com/abc', reference: 'x' } });
    const r = await startCheckout(ctx, seller, 'business');
    assert.equal(r.url, 'https://checkout.paystack.com/abc');
    assert.match(r.reference, /^ceenit_/);
    assert.equal(calls[0]!.body.plan, 'PLN_b');
    assert.equal(calls[0]!.body.amount, 1_500_000);
    assert.equal(calls[0]!.body.metadata.sellerId, seller.id);
  });

  it('turns the plan on after a successful payment, and counts one payment only once', async () => {
    const { ctx, seller } = await setup();
    ctx.paystack = new Paystack('sk_test_x', (async () => new Response(JSON.stringify({ status: true, data: success(seller.id) }), { status: 200 })) as unknown as typeof fetch);
    assert.deepEqual(await confirmCheckout(ctx, seller.id, 'ceenit_ref00000001'), { active: true });
    const first = await planRow(ctx, seller.id);
    assert.equal(first.plan, 'seller');
    const days = (first.plan_until!.getTime() - Date.now()) / 86_400_000;
    assert.ok(days > 30 && days < 32, `about a month, got ${days}`);
    await confirmCheckout(ctx, seller.id, 'ceenit_ref00000001'); // the same payment again
    assert.equal((await planRow(ctx, seller.id)).plan_until!.getTime(), first.plan_until!.getTime());
  });

  it('refuses a payment that belongs to another seller, or is too small', async () => {
    const { ctx, seller } = await setup();
    const answer = (data: unknown) => new Paystack('sk_test_x', (async () => new Response(JSON.stringify({ status: true, data }), { status: 200 })) as unknown as typeof fetch);
    ctx.paystack = answer(success('someone-else'));
    await assert.rejects(confirmCheckout(ctx, seller.id, 'ceenit_ref00000002'), (e: any) => e.code === 'payment_mismatch');
    ctx.paystack = answer({ ...success(seller.id), amount: 100 });
    await assert.rejects(confirmCheckout(ctx, seller.id, 'ceenit_ref00000003'), (e: any) => e.code === 'payment_mismatch');
    ctx.paystack = answer({ status: 'abandoned' });
    assert.deepEqual(await confirmCheckout(ctx, seller.id, 'ceenit_ref00000004'), { active: false });
    assert.equal((await planRow(ctx, seller.id)).plan, 'free');
  });

  it('stops new links once the paid month has run out, but keeps the account readable', async () => {
    const { ctx, seller } = await setup();
    await ctx.db.query(`update sellers set plan = 'seller', plan_until = now() + interval '5 days' where id = $1`, [seller.id]);
    await createInvoice(ctx, { sellerId: seller.id, item: 'Works while paid', amount: '10', expiryMinutes: 30, ack: true });
    await ctx.db.query(`update sellers set plan_until = now() - interval '1 day' where id = $1`, [seller.id]);
    await assert.rejects(createInvoice(ctx, { sellerId: seller.id, item: 'After it ended', amount: '10', expiryMinutes: 30, ack: true }), (e: any) => e.code === 'subscription_ended' && e.status === 402);
    assert.equal((await ctx.db.query(`select 1 from invoices where seller_id = $1`, [seller.id])).length, 1);
  });

  it('cancels with Paystack and keeps the plan until the paid month ends', async () => {
    const { ctx, seller, calls } = await setup({ '/subscription?customer': [{ subscription_code: 'SUB_1', email_token: 'tok', status: 'active' }, { subscription_code: 'SUB_0', email_token: 't0', status: 'cancelled' }], '/subscription/disable': {} });
    await ctx.db.query(`update sellers set plan = 'seller', plan_until = now() + interval '10 days', paystack_customer = 'CUS_1' where id = $1`, [seller.id]);
    await cancelSubscription(ctx, seller.id);
    const disables = calls.filter((c) => c.path === '/subscription/disable');
    assert.equal(disables.length, 1);
    assert.deepEqual(disables[0]!.body, { code: 'SUB_1', token: 'tok' });
    const row = await planRow(ctx, seller.id);
    assert.equal(row.sub_cancelled, true);
    assert.equal(row.plan, 'seller');
  });

  it('extends the plan on a monthly renewal found by customer, and marks a cancellation from the webhook', async () => {
    const { ctx, seller } = await setup();
    await ctx.db.query(`update sellers set plan = 'seller', plan_until = now() + interval '2 days', paystack_customer = 'CUS_9' where id = $1`, [seller.id]);
    await handleWebhook(ctx, { event: 'charge.success', data: { status: 'success', reference: 'ceenit_renew0001', amount: 500_000, customer: { customer_code: 'CUS_9' }, plan: { plan_code: 'PLN_s' } } });
    const days = ((await planRow(ctx, seller.id)).plan_until!.getTime() - Date.now()) / 86_400_000;
    assert.ok(days > 32 && days < 34, `renewal adds a month on top, got ${days}`);
    await handleWebhook(ctx, { event: 'subscription.not_renew', data: { customer: { customer_code: 'CUS_9' } } });
    assert.equal((await planRow(ctx, seller.id)).sub_cancelled, true);
  });

  it('accepts only webhooks signed with the secret key', () => {
    const body = JSON.stringify({ event: 'charge.success' });
    const good = createHmac('sha512', 'sk_test_x').update(body).digest('hex');
    assert.equal(webhookSignatureOk('sk_test_x', body, good), true);
    assert.equal(webhookSignatureOk('sk_test_x', body, good.replace(/.$/, '0')), false);
    assert.equal(webhookSignatureOk('sk_test_x', body + ' ', good), false);
    assert.equal(webhookSignatureOk('sk_test_x', body, undefined), false);
  });
});

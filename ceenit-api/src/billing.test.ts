import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';
import { Paystack, webhookSignatureOk } from './billing/paystack';
import { loadConfig } from './config';
import { openDb } from './db';
import { billingHistory, cancelSubscription, confirmCheckout, handleWebhook, PLAN_PRICES, startCheckout, sweepBillingReminders } from './domain/billing';
import { Ctx, NotifyEvent } from './domain/context';
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
    const { ctx, seller, calls } = await setup({ '/customer/CUS_1': { id: 411979791 }, '/subscription?customer=411979791': [{ subscription_code: 'SUB_1', email_token: 'tok', status: 'active' }, { subscription_code: 'SUB_0', email_token: 't0', status: 'cancelled' }], '/subscription/disable': {} });
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

describe('plan switching, history and reminders', () => {
  const sellerRow = async (ctx: Ctx, id: string) => (await ctx.db.query<any>(`select * from sellers where id = $1`, [id]))[0]!;
  const withPlan = async (ctx: Ctx, id: string, set: string) => { await ctx.db.query(`update sellers set ${set} where id = $1`, [id]); return sellerRow(ctx, id); };
  const capture = (ctx: Ctx) => { const events: NotifyEvent[] = []; ctx.notifier = { notify: async (e) => void events.push(e) }; return events; };

  it('will not start a second checkout for the plan the seller already pays for, but allows switching or renewing a cancelled plan', async () => {
    const { ctx, seller } = await setup({ '/transaction/initialize': { authorization_url: 'https://checkout.paystack.com/abc', reference: 'x' } });
    const active = await withPlan(ctx, seller.id, `plan = 'seller', plan_until = now() + interval '10 days'`);
    await assert.rejects(startCheckout(ctx, active, 'seller'), (e: any) => e.code === 'already_subscribed' && e.status === 409);
    assert.ok((await startCheckout(ctx, active, 'business')).url); // switching is allowed
    const cancelled = await withPlan(ctx, seller.id, `sub_cancelled = true`);
    assert.ok((await startCheckout(ctx, cancelled, 'seller')).url); // subscribing again after cancelling is allowed
    const ended = await withPlan(ctx, seller.id, `sub_cancelled = false, plan_until = now() - interval '1 day'`);
    assert.ok((await startCheckout(ctx, ended, 'seller')).url); // an ended plan can be renewed
  });

  it('stops the old monthly charge when a seller moves to the other plan', async () => {
    const { ctx, seller } = await setup();
    await ctx.db.query(`update sellers set plan = 'seller', plan_until = now() + interval '10 days', paystack_customer = 'CUS_1' where id = $1`, [seller.id]);
    const fp = fakePaystack({
      '/transaction/verify': success(seller.id, 'business', 'ceenit_ref00000010'),
      '/customer/CUS_1': { id: 411979791 },
      '/subscription?customer=411979791': [
        { subscription_code: 'SUB_OLD', email_token: 'told', status: 'active', plan: { plan_code: 'PLN_s' } },
        { subscription_code: 'SUB_NEW', email_token: 'tnew', status: 'active', plan: { plan_code: 'PLN_b' } },
      ],
      '/subscription/disable': {},
    });
    ctx.paystack = fp.paystack;
    await confirmCheckout(ctx, seller.id, 'ceenit_ref00000010');
    const disables = fp.calls.filter((c) => c.path === '/subscription/disable');
    assert.deepEqual(disables.map((d) => d.body.code), ['SUB_OLD']);
    assert.equal((await planRow(ctx, seller.id)).plan, 'business');
  });

  it('lists subscription payments newest first', async () => {
    const { ctx, seller } = await setup();
    ctx.paystack = fakePaystack({ '/transaction/verify': success(seller.id, 'seller', 'ceenit_ref00000020') }).paystack;
    await confirmCheckout(ctx, seller.id, 'ceenit_ref00000020');
    const h = await billingHistory(ctx, seller.id);
    assert.deepEqual(h.map((p) => [p.plan, p.amountKobo, p.reference]), [['seller', 500_000, 'ceenit_ref00000020']]);
  });

  it('warns once when a cancelled plan is about to end, and once when a plan has ended', async () => {
    const { ctx, seller } = await setup();
    const events = capture(ctx);
    await ctx.db.query(`update sellers set plan = 'seller', sub_cancelled = true, plan_until = now() + interval '2 days' where id = $1`, [seller.id]);
    await sweepBillingReminders(ctx);
    await sweepBillingReminders(ctx);
    assert.deepEqual(events.map((e) => e.type), ['plan_ending']);

    await ctx.db.query(`update sellers set plan_until = now() - interval '1 hour' where id = $1`, [seller.id]);
    await sweepBillingReminders(ctx);
    await sweepBillingReminders(ctx);
    assert.deepEqual(events.map((e) => e.type), ['plan_ending', 'plan_ended']);
  });

  it('does not warn about a plan that will renew by itself, and tells the seller when a renewal fails', async () => {
    const { ctx, seller } = await setup();
    const events = capture(ctx);
    await ctx.db.query(`update sellers set plan = 'seller', sub_cancelled = false, plan_until = now() + interval '2 days', paystack_customer = 'CUS_7' where id = $1`, [seller.id]);
    await sweepBillingReminders(ctx);
    assert.equal(events.length, 0);
    await handleWebhook(ctx, { event: 'invoice.payment_failed', data: { customer: { customer_code: 'CUS_7' } } });
    assert.deepEqual(events.map((e) => e.type), ['billing_failed']);
  });
});

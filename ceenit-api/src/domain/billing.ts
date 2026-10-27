import { PaystackTransaction } from '../billing/paystack';
import { AppError, Ctx } from './context';
import { newId } from './invoices';

// Subscriptions. A seller pays for the Seller or Business plan on Paystack's own checkout page.
// Ceeneet then records the plan and the date it runs to. Free sellers can still see their first 5 payments after a plan ends.

export type PlanKey = 'seller' | 'business';

/** Prices in kobo (₦1 = 100 kobo). Shown to sellers in the app as ₦5,000 and ₦15,000 a month. */
export const PLAN_PRICES: Record<PlanKey, number> = { seller: 500_000, business: 1_500_000 };
export const PLAN_NAMES: Record<PlanKey, string> = { seller: 'Seller', business: 'Business' };
const PERIOD_DAYS = 31;

export const isPlanKey = (p: unknown): p is PlanKey => p === 'seller' || p === 'business';

type Billable = { id: string; contact: string; contact_method: 'phone' | 'email'; plan?: string; plan_until?: Date | null; sub_cancelled?: boolean };

/** Paystack needs an email on every payment. Phone-only sellers get a placeholder address, so receipts are shown in the app instead. */
const emailFor = (s: Billable) => (s.contact_method === 'email' ? s.contact : `${s.id}@billing.ceenit.app`);

export async function startCheckout(ctx: Ctx, seller: Billable, plan: PlanKey): Promise<{ url: string; reference: string }> {
  const planCode = ctx.cfg.planCodes[plan];
  if (!ctx.paystack || !planCode) throw new AppError('billing_not_ready', 503, 'Subscriptions are not switched on yet.');
  // Already paying for this plan and not cancelled: a second checkout would start a second monthly charge.
  const active = !!seller.plan && seller.plan !== 'free' && (!seller.plan_until || seller.plan_until.getTime() > Date.now());
  if (active && seller.plan === plan && !seller.sub_cancelled) throw new AppError('already_subscribed', 409, `You are already on the ${PLAN_NAMES[plan]} plan.`);
  const reference = `ceenit_${newId(16)}`;
  const tx = await ctx.paystack.initialize({
    email: emailFor(seller),
    amountKobo: PLAN_PRICES[plan],
    planCode,
    reference,
    callbackUrl: `${ctx.cfg.publicBaseUrl}/billing/done`,
    metadata: { sellerId: seller.id, plan },
  });
  return { url: tx.authorization_url, reference };
}

/** Records one successful payment. Safe to call twice for the same reference: it only counts once. */
export async function applyPayment(ctx: Ctx, sellerId: string, plan: PlanKey, tx: Pick<PaystackTransaction, 'reference' | 'amount' | 'customer'>): Promise<boolean> {
  const first = await ctx.db.query(
    `insert into billing_events (reference, seller_id, plan, amount_kobo) values ($1, $2, $3, $4::bigint) on conflict (reference) do nothing returning reference`,
    [tx.reference, sellerId, plan, String(tx.amount)],
  );
  if (!first.length) return false;
  const [before] = await ctx.db.query<{ plan: string }>(`select plan from sellers where id = $1`, [sellerId]);
  await ctx.db.query(
    `update sellers
        set plan = $2,
            plan_until = greatest(coalesce(plan_until, now()), now()) + ($3::int * interval '1 day'),
            sub_cancelled = false,
            paystack_customer = coalesce($4, paystack_customer)
      where id = $1`,
    [sellerId, plan, PERIOD_DAYS, tx.customer?.customer_code ?? null],
  );
  // Moving from one paid plan to the other: stop the old monthly charge so the seller is not billed twice.
  if (before && before.plan !== 'free' && before.plan !== plan && tx.customer?.customer_code) await disableOtherSubscriptions(ctx, tx.customer.customer_code, plan);
  return true;
}

/** Cancels every active Paystack subscription for this customer except the one for the plan they just chose. Never fails the payment. */
export async function disableOtherSubscriptions(ctx: Ctx, customerCode: string, keep: PlanKey): Promise<void> {
  if (!ctx.paystack) return;
  try {
    const keepCode = ctx.cfg.planCodes[keep];
    const subs = await ctx.paystack.subscriptionsFor(customerCode);
    for (const sub of subs.filter((x) => x.status === 'active' && x.plan?.plan_code !== keepCode)) await ctx.paystack.disable(sub.subscription_code, sub.email_token);
  } catch (e) {
    console.error('[billing] could not stop the old subscription:', e instanceof Error ? e.message : e);
  }
}

export type BillingPayment = { reference: string; plan: string; amountKobo: number; at: string };

/** The seller's subscription payments, newest first. This is their receipt list. */
export async function billingHistory(ctx: Ctx, sellerId: string): Promise<BillingPayment[]> {
  const rows = await ctx.db.query<{ reference: string; plan: string; amount_kobo: string; created_at: Date }>(
    `select reference, plan, amount_kobo::text as amount_kobo, created_at from billing_events where seller_id = $1 order by created_at desc limit 36`,
    [sellerId],
  );
  return rows.map((r) => ({ reference: r.reference, plan: r.plan, amountKobo: Number(r.amount_kobo), at: r.created_at.toISOString() }));
}

const dayText = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });

/** Tells sellers when a cancelled plan is about to end and when a plan has ended. Each is sent once per plan period. */
export async function sweepBillingReminders(ctx: Ctx): Promise<void> {
  const ending = await ctx.db.query<{ id: string; plan_until: Date }>(
    `update sellers set ending_notified_until = plan_until
      where plan <> 'free' and sub_cancelled and plan_until between now() and now() + interval '3 days' and ending_notified_until is distinct from plan_until
      returning id, plan_until`,
  );
  for (const s of ending) await ctx.notifier.notify({ type: 'plan_ending', sellerId: s.id, detail: dayText(s.plan_until) });
  const ended = await ctx.db.query<{ id: string }>(
    `update sellers set ended_notified_until = plan_until
      where plan <> 'free' and plan_until is not null and plan_until < now() and ended_notified_until is distinct from plan_until
      returning id`,
  );
  for (const s of ended) await ctx.notifier.notify({ type: 'plan_ended', sellerId: s.id });
}

/** The app calls this after the seller comes back from Paystack's page. Works without any public web address. */
export async function confirmCheckout(ctx: Ctx, sellerId: string, reference: string): Promise<{ active: boolean }> {
  if (!ctx.paystack) throw new AppError('billing_not_ready', 503, 'Subscriptions are not switched on yet.');
  if (!/^ceenit_[A-Za-z0-9]{6,40}$/.test(reference)) throw new AppError('bad_reference', 400);
  const tx = await ctx.paystack.verify(reference);
  const plan = tx.metadata?.plan;
  if (tx.status !== 'success') return { active: false };
  // Only count a payment that this seller started, for a real plan, at the full price.
  if (tx.metadata?.sellerId !== sellerId || !isPlanKey(plan) || tx.amount < PLAN_PRICES[plan]) {
    throw new AppError('payment_mismatch', 400, 'This payment does not match your account.');
  }
  await applyPayment(ctx, sellerId, plan, tx);
  return { active: true };
}

export async function cancelSubscription(ctx: Ctx, sellerId: string): Promise<void> {
  if (!ctx.paystack) throw new AppError('billing_not_ready', 503, 'Subscriptions are not switched on yet.');
  const [s] = await ctx.db.query<{ paystack_customer: string | null }>(`select paystack_customer from sellers where id = $1`, [sellerId]);
  if (!s?.paystack_customer) throw new AppError('not_subscribed', 409, 'You do not have a subscription to cancel.');
  const subs = await ctx.paystack.subscriptionsFor(s.paystack_customer);
  for (const sub of subs.filter((x) => x.status === 'active')) await ctx.paystack.disable(sub.subscription_code, sub.email_token);
  // The plan stays until the month already paid for runs out. After that the account is read-only.
  await ctx.db.query(`update sellers set sub_cancelled = true where id = $1`, [sellerId]);
}

type WebhookEvent = { event: string; data: any };

/** Paystack tells us about renewals and cancellations here. Needs a public web address, so it only runs once Ceeneet is online. */
export async function handleWebhook(ctx: Ctx, e: WebhookEvent): Promise<void> {
  const customerCode: string | undefined = e.data?.customer?.customer_code;
  const sellerByCustomer = async () => {
    if (!customerCode) return null;
    const [s] = await ctx.db.query<{ id: string; plan: string }>(`select id, plan from sellers where paystack_customer = $1`, [customerCode]);
    return s ?? null;
  };

  if (e.event === 'charge.success') {
    const tx = e.data as PaystackTransaction;
    if (tx.status !== 'success') return;
    let sellerId = tx.metadata?.sellerId;
    let plan: unknown = tx.metadata?.plan;
    if (!sellerId || !isPlanKey(plan)) {
      // A monthly renewal carries no metadata. Find the seller by customer and the plan by its Paystack code.
      const s = await sellerByCustomer();
      const code = tx.plan?.plan_code;
      plan = (Object.keys(ctx.cfg.planCodes) as PlanKey[]).find((k) => ctx.cfg.planCodes[k] === code);
      sellerId = s?.id;
    }
    if (sellerId && isPlanKey(plan) && tx.amount >= PLAN_PRICES[plan]) await applyPayment(ctx, sellerId, plan, tx);
  } else if (e.event === 'invoice.payment_failed') {
    const s = await sellerByCustomer();
    if (s) await ctx.notifier.notify({ type: 'billing_failed', sellerId: s.id });
  } else if (e.event === 'subscription.disable' || e.event === 'subscription.not_renew') {
    const s = await sellerByCustomer();
    if (s) await ctx.db.query(`update sellers set sub_cancelled = true where id = $1`, [s.id]);
  }
}

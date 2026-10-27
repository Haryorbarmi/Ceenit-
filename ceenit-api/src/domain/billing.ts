import { PaystackTransaction } from '../billing/paystack';
import { AppError, Ctx } from './context';
import { newId } from './invoices';

// Subscriptions. A seller pays for the Seller or Business plan on Paystack's own checkout page.
// Ceenit then records the plan and the date it runs to. Free sellers can still see their first 5 payments after a plan ends.

export type PlanKey = 'seller' | 'business';

/** Prices in kobo (₦1 = 100 kobo). Shown to sellers in the app as ₦5,000 and ₦15,000 a month. */
export const PLAN_PRICES: Record<PlanKey, number> = { seller: 500_000, business: 1_500_000 };
export const PLAN_NAMES: Record<PlanKey, string> = { seller: 'Seller', business: 'Business' };
const PERIOD_DAYS = 31;

export const isPlanKey = (p: unknown): p is PlanKey => p === 'seller' || p === 'business';

type Billable = { id: string; contact: string; contact_method: 'phone' | 'email' };

/** Paystack needs an email on every payment. Phone-only sellers get a placeholder address, so receipts are shown in the app instead. */
const emailFor = (s: Billable) => (s.contact_method === 'email' ? s.contact : `${s.id}@billing.ceenit.app`);

export async function startCheckout(ctx: Ctx, seller: Billable, plan: PlanKey): Promise<{ url: string; reference: string }> {
  const planCode = ctx.cfg.planCodes[plan];
  if (!ctx.paystack || !planCode) throw new AppError('billing_not_ready', 503, 'Subscriptions are not switched on yet.');
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
  await ctx.db.query(
    `update sellers
        set plan = $2,
            plan_until = greatest(coalesce(plan_until, now()), now()) + ($3::int * interval '1 day'),
            sub_cancelled = false,
            paystack_customer = coalesce($4, paystack_customer)
      where id = $1`,
    [sellerId, plan, PERIOD_DAYS, tx.customer?.customer_code ?? null],
  );
  return true;
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

/** Paystack tells us about renewals and cancellations here. Needs a public web address, so it only runs once Ceenit is online. */
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
  } else if (e.event === 'subscription.disable' || e.event === 'subscription.not_renew') {
    const s = await sellerByCustomer();
    if (s) await ctx.db.query(`update sellers set sub_cancelled = true where id = $1`, [s.id]);
  }
}

import { createHmac, timingSafeEqual } from 'node:crypto';
import { AppError } from '../domain/context';

// A small client for Paystack, which takes the monthly subscription payments.
// Money goes from the seller's card or bank straight to Ceenit's Paystack account. Ceenit never sees card details.

type Fetch = typeof fetch;

export type PaystackTransaction = {
  status: string; // 'success' when paid
  reference: string;
  amount: number; // in kobo
  paid_at?: string;
  metadata?: { sellerId?: string; plan?: string } | null;
  customer?: { customer_code?: string; email?: string };
  plan?: { plan_code?: string } | null;
};

export type PaystackSubscription = { subscription_code: string; email_token: string; status: string; plan?: { plan_code?: string } };

export class Paystack {
  constructor(private secret: string, private doFetch: Fetch = fetch) {}

  private async call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await this.doFetch(`https://api.paystack.co${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.secret}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new AppError('billing_unavailable', 503, 'We could not reach the payment service. Please try again.');
    }
    const json = (await res.json().catch(() => ({}))) as { status?: boolean; message?: string; data?: T };
    if (!res.ok || json.status === false) {
      console.error(`[paystack] ${method} ${path} failed (${res.status}): ${json.message ?? ''}`);
      throw new AppError('billing_failed', 502, 'The payment service refused this request. Please try again.');
    }
    return json.data as T;
  }

  createPlan(name: string, amountKobo: number) {
    return this.call<{ plan_code: string }>('POST', '/plan', { name, amount: amountKobo, interval: 'monthly', currency: 'NGN' });
  }

  initialize(p: { email: string; amountKobo: number; planCode: string; reference: string; callbackUrl: string; metadata: Record<string, string> }) {
    return this.call<{ authorization_url: string; reference: string }>('POST', '/transaction/initialize', {
      email: p.email,
      amount: p.amountKobo,
      plan: p.planCode,
      reference: p.reference,
      callback_url: p.callbackUrl,
      currency: 'NGN',
      metadata: p.metadata,
    });
  }

  verify(reference: string) {
    return this.call<PaystackTransaction>('GET', `/transaction/verify/${encodeURIComponent(reference)}`);
  }

  /** A customer's subscriptions. Paystack's list only filters by the customer's number ID, not the CUS_ code, so look the ID up first. */
  async subscriptionsFor(customerCode: string): Promise<PaystackSubscription[]> {
    const customer = await this.call<{ id?: number }>('GET', `/customer/${encodeURIComponent(customerCode)}`);
    if (!customer?.id) return [];
    return this.call<PaystackSubscription[]>('GET', `/subscription?customer=${customer.id}`);
  }

  disable(code: string, token: string) {
    return this.call<unknown>('POST', '/subscription/disable', { code, token });
  }
}

/** Paystack signs every webhook with HMAC-SHA512 of the raw body, using the secret key. Anything else is ignored. */
export function webhookSignatureOk(secret: string, rawBody: string, signature: string | undefined): boolean {
  if (!signature) return false;
  const expected = createHmac('sha512', secret).update(rawBody).digest('hex');
  return expected.length === signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

import type { Paystack } from '../billing/paystack';
import type { RateService } from '../billing/rate';
import type { Config } from '../config';
import type { Db } from '../db';
import type { TronClient } from '../tron/types';

/** Things the seller should hear about. In the app these become push notifications. */
export type NotifyEvent = {
  type: 'payment_detected' | 'payment_confirmed' | 'payment_flagged' | 'payment_unmatched' | 'link_requested' | 'invoice_expired' | 'new_device' | 'wallet_change_requested' | 'wallet_changed' | 'plan_ending' | 'plan_ended' | 'billing_failed';
  sellerId: string;
  invoiceId?: string;
  detail?: string;
};

export interface Notifier {
  notify(e: NotifyEvent): Promise<void>;
}

export const consoleNotifier: Notifier = {
  async notify(e) {
    console.log(`[notify] ${e.type} seller=${e.sellerId} invoice=${e.invoiceId ?? '-'} ${e.detail ?? ''}`);
  },
};

/** Sends a login code. In production this is the WhatsApp Business API (phone) or an email service. */
export type CodeSender = (contact: string, method: 'phone' | 'email', code: string) => Promise<void>;

export const consoleCodeSender: CodeSender = async (contact, method, code) => {
  console.log(`[login code] ${method} ${contact}: ${code}`);
};

/** Everything a service function needs. Passed in, so tests can swap in a fake network and an in-memory database. */
export type Ctx = { db: Db; cfg: Config; tron: TronClient; notifier: Notifier; sendCode: CodeSender; paystack?: Paystack; rates?: RateService };

export class AppError extends Error {
  constructor(
    public code: string,
    public status = 400,
    message?: string,
  ) {
    super(message ?? code);
  }
}

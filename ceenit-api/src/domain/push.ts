import type { Db } from '../db';
import type { NotifyEvent, Notifier } from './context';
import { newId } from './invoices';

// Phone alerts, sent through Expo's push service. A seller's phone registers its token after login.
// If a send fails, nothing else is affected: the payment is still recorded, the alert is just missed.

export type PushMessage = { to: string; title: string; body: string; sound: 'default'; data: Record<string, string> };
type Ticket = { status: 'ok' | 'error'; details?: { error?: string } };
export type PushSender = (messages: PushMessage[]) => Promise<Ticket[]>;

const EXPO_URL = 'https://exp.host/--/api/v2/push/send';

export const expoSender: PushSender = async (messages) => {
  const res = await fetch(EXPO_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(messages) });
  const json = (await res.json()) as { data?: Ticket[] };
  return json.data ?? [];
};

const flagWords = { late: 'came in after the link expired', underpaid: 'is less than the amount due', overpaid: 'is more than the amount due' } as const;

/** The words on the lock screen for each kind of event. */
export function compose(e: NotifyEvent, item?: string): { title: string; body: string } {
  const what = item ? ` for ${item}` : '';
  switch (e.type) {
    case 'payment_detected':
      return { title: 'Payment found', body: `${e.detail}${what} is on its way. Confirming on TRON now.` };
    case 'payment_confirmed':
      return { title: 'You have been paid', body: `${e.detail}${what} is confirmed on TRON.` };
    case 'payment_flagged': {
      const [kind = '', amount = ''] = (e.detail ?? '').split(': ');
      return { title: 'A payment needs your attention', body: `${amount}${what} ${flagWords[kind as keyof typeof flagWords] ?? 'does not match the invoice'}. Open Ceenit to review.` };
    }
    case 'payment_unmatched':
      return { title: 'Unmatched payment', body: `${e.detail} arrived in your wallet but does not match any of your links.` };
    case 'new_device':
      return { title: 'New device logged in', body: `${e.detail || 'A device'} just logged in to your Ceenit account. If this was not you, open Security and log it out.` };
    case 'wallet_change_requested':
      return { title: 'Wallet change requested', body: `A new wallet (${e.detail}) will take over in 24 hours. If this was not you, open Wallet and cancel it now.` };
    case 'wallet_changed':
      return { title: 'Your wallet has changed', body: `New payment links now go to ${e.detail}. Links made earlier still pay the old wallet.` };
    case 'invoice_expired':
      return { title: 'Link expired', body: `${item ?? 'A payment link'} expired without a payment.` };
    case 'link_requested':
      return { title: 'New link request', body: `${e.detail || 'A buyer'} asked for a fresh link${what}. Open Ceenit to approve.` };
  }
}

export class PushNotifier implements Notifier {
  constructor(private db: Db, private send: PushSender = expoSender, private next?: Notifier) {}

  async notify(e: NotifyEvent): Promise<void> {
    await this.next?.notify(e);
    try {
      // The seller can switch off "payment found" and switch on "link expired". Switched off means no alert at all, in the inbox or on the phone.
      const [prefs] = await this.db.query<{ notify_detected: boolean; notify_expired: boolean }>(`select notify_detected, notify_expired from sellers where id = $1`, [e.sellerId]);
      if (prefs && ((e.type === 'payment_detected' && !prefs.notify_detected) || (e.type === 'invoice_expired' && !prefs.notify_expired))) return;
      let item: string | undefined;
      if (e.invoiceId) item = (await this.db.query<{ item: string }>(`select item from invoices where id = $1`, [e.invoiceId]))[0]?.item;
      const { title, body } = compose(e, item);
      // Keep a copy for the bell inbox, whether or not this seller has a phone registered for alerts.
      await this.db.query(`insert into notifications (id, seller_id, type, title, body, invoice_id) values ($1, $2, $3, $4, $5, $6)`, [newId(12), e.sellerId, e.type, title, body, e.invoiceId ?? null]);
      if (e.type === 'invoice_expired') return; // inbox only, no phone alert
      const tokens = (await this.db.query<{ token: string }>(`select token from push_tokens where seller_id = $1`, [e.sellerId])).map((r) => r.token);
      if (!tokens.length) return;
      const data: Record<string, string> = { type: e.type, ...(e.invoiceId ? { invoiceId: e.invoiceId } : {}) };
      const tickets = await this.send(tokens.map((to) => ({ to, title, body, sound: 'default' as const, data })));
      // A phone that has uninstalled the app or turned alerts off is dropped so we stop sending to it.
      const dead = tokens.filter((_, i) => tickets[i]?.status === 'error' && tickets[i]?.details?.error === 'DeviceNotRegistered');
      for (const t of dead) await this.db.query(`delete from push_tokens where token = $1`, [t]);
    } catch (err) {
      console.error('[push] could not send:', err instanceof Error ? err.message : err);
    }
  }
}

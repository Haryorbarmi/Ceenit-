import { baseOf } from '../money';

// Decides which invoice (if any) an incoming payment belongs to, and whether it is a clean payment or needs the seller's eye.

export type InvoiceLite = {
  id: string;
  status: string;
  amountMicro: bigint;
  createdAtMs: number;
  expiresAtMs: number;
};

export type Outcome =
  | { kind: 'paid'; invoiceId: string } // exact amount, inside the time window
  | { kind: 'late'; invoiceId: string } // exact amount, but after the link expired
  | { kind: 'underpaid'; invoiceId: string } // the only open invoice, but less than due
  | { kind: 'overpaid'; invoiceId: string } // the only open invoice, but more than due
  | { kind: 'unmatched' }; // cannot tell which invoice it is for

/** Clocks differ: the database, this server and the TRON network can disagree by a few seconds. A payment this close before a link was created still counts. */
export const CLOCK_SKEW_MS = 120_000;

export function classify(p: { receivedMicro: bigint; atMs: number; invoices: InvoiceLite[]; lateWindowMs: number }): Outcome {
  const { receivedMicro, atMs, invoices, lateWindowMs } = p;
  const isOpen = (i: InvoiceLite) => i.status === 'pending' && i.createdAtMs - CLOCK_SKEW_MS <= atMs && atMs <= i.expiresAtMs;

  // 1. Exact amount while the link is open: a clean payment.
  const exact = invoices.find((i) => isOpen(i) && i.amountMicro === receivedMicro);
  if (exact) return { kind: 'paid', invoiceId: exact.id };

  // 2. Exact amount a little after the link expired: flag it, never mark it Paid by itself.
  const late = invoices.find(
    (i) =>
      (i.status === 'pending' || i.status === 'expired') &&
      i.amountMicro === receivedMicro &&
      atMs > i.expiresAtMs &&
      atMs <= i.expiresAtMs + lateWindowMs,
  );
  if (late) return { kind: 'late', invoiceId: late.id };

  // 3. Wrong amount. If only one link was open, the payment is almost certainly for it.
  //    If several are open, use the whole-USDT price to tell them apart; otherwise we cannot be sure.
  const open = invoices.filter(isOpen);
  const guess = open.length === 1 ? open[0] : open.filter((i) => baseOf(i.amountMicro) === baseOf(receivedMicro)).length === 1
    ? open.find((i) => baseOf(i.amountMicro) === baseOf(receivedMicro))
    : undefined;
  if (guess) {
    return { kind: receivedMicro < guess.amountMicro ? 'underpaid' : 'overpaid', invoiceId: guess.id };
  }

  return { kind: 'unmatched' };
}

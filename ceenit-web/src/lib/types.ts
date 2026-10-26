// What the buyer page needs to know about one payment link.
// The real version comes from the Ceenit backend. Until that exists, src/lib/store.ts fakes it.

export type Status =
  | 'waiting' // link is live, nothing received yet
  | 'confirming' // payment seen on TRON, waiting for confirmations
  | 'paid' // all six checks passed
  | 'expired' // link ran out without a payment
  | 'requested' // buyer asked the seller for a new link
  | 'late' // payment arrived after expiry, flagged for the seller
  | 'underpaid' // less than the exact amount, flagged for the seller
  | 'overpaid'; // more than the exact amount, flagged for the seller

export type Seller = {
  slug: string;
  name: string;
  category: string;
  city: string;
  since: string;
  phone: string; // for the "message the seller" button
};

export type Invoice = {
  id: string;
  seller: Seller;
  item: string;
  /** Exact amount due in USDT, including the unique cents. */
  amount: number;
  network: 'TRON (TRC20)';
  wallet: string;
  expiresAt: number;
  status: Status;
  confirmationsDone: number;
  confirmationsTotal: number;
  txId?: string;
  paidAt?: number;
  /** For underpaid, overpaid and late payments: what actually arrived. */
  received?: number;
  receivedAt?: number;
  requestCount: number;
  /** Set when the seller approves a new-link request. */
  nextId?: string;
};

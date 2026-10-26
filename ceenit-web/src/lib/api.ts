import type { Invoice, Seller, Status } from './types';

// The buyer pages talk to the Ceenit API. The browser only ever talks to this web server, which calls the API on its behalf,
// so phones never need to reach the API directly.
export const API_URL = process.env.CEENIT_API_URL ?? 'http://localhost:4000';

/** What the API sends for a public invoice. Amounts are exact decimal strings. */
export type ApiInvoice = {
  id: string;
  seller: { slug: string; name: string; category: string; city: string; since: string; phone: string | null };
  item: string;
  amount: string;
  network: 'TRON (TRC20)';
  wallet: string;
  expiresAt: number;
  status: Status;
  confirmationsDone: number;
  confirmationsTotal: number;
  txId?: string;
  paidAt?: number;
  received?: string;
  receivedAt?: number;
  requestCount: number;
  nextId?: string;
};

export function toInvoice(p: ApiInvoice): Invoice {
  return {
    ...p,
    seller: { ...p.seller, phone: p.seller.phone ?? '' },
    amount: Number(p.amount),
    received: p.received === undefined ? undefined : Number(p.received),
  };
}

/** Returns null when the link does not exist. Throws if the API is down, so the page shows an error rather than "not found". */
export async function fetchInvoice(id: string): Promise<Invoice | null> {
  const res = await fetch(`${API_URL}/v1/public/invoices/${encodeURIComponent(id)}`, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Ceenit API returned ${res.status}`);
  return toInvoice((await res.json()) as ApiInvoice);
}

export async function fetchSeller(slug: string): Promise<Pick<Seller, 'slug' | 'name' | 'category' | 'city' | 'since'> | null> {
  const res = await fetch(`${API_URL}/v1/public/sellers/${encodeURIComponent(slug)}`, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Ceenit API returned ${res.status}`);
  return res.json();
}

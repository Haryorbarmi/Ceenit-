import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { Status } from '@/components/Chips';
import { api, Invoice, LinkRequest } from '@/lib/api';
import { formatUsdt } from '@/lib/format';
import { useSession } from '@/state/session';

// The seller's payment links, loaded from the Ceeneet API. The blockchain watcher on the server moves
// each link from Pending to Paid, so the app just asks again every few seconds while it is open.

export const expiryOptions = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '2 hrs', minutes: 120 },
  { label: '24 hrs', minutes: 1440 },
] as const;

export type Draft = { item: string; amount: string; reference: string; expiry: string };

export type Txn = {
  id: string;
  item: string;
  sub: string;
  amount: string;
  status: Status;
  group: 'Today' | 'Earlier';
};

const POLL_MS = 5000;

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
const sameDay = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();
const commas = (amount: string) => formatUsdt(Number(amount));

const flagText = { late: 'Late payment', underpaid: 'Underpaid', overpaid: 'Overpaid' } as const;

export function statusOf(i: Invoice): Status {
  if (i.status === 'paid') return 'Paid';
  if (i.status === 'expired') return 'Expired';
  if (i.status === 'late' || i.status === 'underpaid' || i.status === 'overpaid') return 'Needs attention';
  return 'Pending';
}

function toTxn(i: Invoice): Txn {
  const ref = i.reference ? `${i.reference} · ` : '';
  const status = statusOf(i);
  const sub =
    status === 'Paid' ? `${ref}${time(i.paidAt ?? i.createdAt)}`
    : status === 'Expired' ? `${ref}expired unpaid`
    : status === 'Needs attention' ? `${flagText[i.status as keyof typeof flagText]} · ${time(i.createdAt)}`
    : i.status === 'confirming' ? `${ref}payment found, confirming`
    : `${ref}expires ${time(i.expiresAt)}`;
  return { id: i.id, item: i.item, sub, amount: commas(i.amount), status, group: sameDay(i.createdAt) ? 'Today' : 'Earlier' };
}

type Ctx = {
  loading: boolean;
  invoices: Invoice[];
  txns: Txn[];
  requests: LinkRequest[];
  totals: { received: number; paid: number; pending: number };
  draft: Draft;
  setDraft: (patch: Partial<Draft>) => void;
  refresh: () => Promise<void>;
  createLink: (draft: Draft) => Promise<Invoice>;
  getInvoice: (id: string) => Invoice | undefined;
};

const emptyDraft: Draft = { item: '', amount: '', reference: '', expiry: '30 min' };
const LinksContext = createContext<Ctx | null>(null);

export function LinksProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [requests, setRequests] = useState<LinkRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraftState] = useState<Draft>(emptyDraft);
  const busy = useRef(false);

  const setDraft = useCallback((patch: Partial<Draft>) => setDraftState((d) => ({ ...d, ...patch })), []);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const [inv, req] = await Promise.all([api.invoices(), api.linkRequests()]);
      setInvoices(inv);
      setRequests(req);
    } catch {
      /* keep showing the last list if the network drops */
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status !== 'in') {
      setInvoices([]);
      setRequests([]);
      return;
    }
    refresh();
    const t = setInterval(() => AppState.currentState === 'active' && refresh(), POLL_MS);
    return () => clearInterval(t);
  }, [status, refresh]);

  const createLink = useCallback(async (d: Draft) => {
    const minutes = expiryOptions.find((e) => e.label === d.expiry)?.minutes ?? 30;
    const created = await api.createInvoice({ item: d.item.trim(), amount: d.amount.replace(/,/g, ''), reference: d.reference.trim() || undefined, expiryMinutes: minutes });
    setInvoices((list) => [created, ...list]);
    setDraftState(emptyDraft);
    return created;
  }, []);

  const getInvoice = useCallback((id: string) => invoices.find((i) => i.id === id), [invoices]);

  const txns = useMemo(() => invoices.map(toTxn), [invoices]);
  const totals = useMemo(() => {
    const paid = invoices.filter((i) => i.status === 'paid');
    return {
      received: paid.reduce((sum, i) => sum + Number(i.amount), 0),
      paid: paid.length,
      pending: invoices.filter((i) => i.status === 'pending' || i.status === 'confirming').length,
    };
  }, [invoices]);

  const value = useMemo(
    () => ({ loading, invoices, txns, requests, totals, draft, setDraft, refresh, createLink, getInvoice }),
    [loading, invoices, txns, requests, totals, draft, setDraft, refresh, createLink, getInvoice],
  );
  return <LinksContext.Provider value={value}>{children}</LinksContext.Provider>;
}

export function useLinks() {
  const ctx = useContext(LinksContext);
  if (!ctx) throw new Error('useLinks must be used inside LinksProvider');
  return ctx;
}

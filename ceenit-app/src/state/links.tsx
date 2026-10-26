import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { Txn, txns as seedTxns } from '@/data/mock';
import { formatUsdt, parseAmount } from '@/lib/format';

// Payment links created in this session. Kept in memory for now.
// The real version stores these on the backend and the blockchain watcher updates their status.

export const expiryOptions = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '2 hrs', minutes: 120 },
  { label: '24 hrs', minutes: 1440 },
] as const;

export type Draft = { item: string; amount: string; reference: string; expiry: string };

export type LinkInfo = {
  id: string;
  item: string;
  reference: string;
  baseAmount: number;
  cents: number;
  total: number;
  expiryLabel: string;
  createdAt: number;
  expiresAt: number;
  url: string;
};

type Ctx = {
  txns: Txn[];
  draft: Draft;
  setDraft: (patch: Partial<Draft>) => void;
  /** A cents value (1 to 99) not used by another open link of the same base amount, or null if all are taken. */
  pickCents: (baseAmount: number) => number | null;
  createLink: (draft: Draft, cents: number) => LinkInfo;
  getLink: (id: string) => LinkInfo | undefined;
};

const emptyDraft: Draft = { item: '', amount: '', reference: '', expiry: '30 min' };
const LinksContext = createContext<Ctx | null>(null);

export function LinksProvider({ children }: { children: ReactNode }) {
  const [txns, setTxns] = useState<Txn[]>(seedTxns);
  const [links, setLinks] = useState<Record<string, LinkInfo>>({});
  const [draft, setDraftState] = useState<Draft>(emptyDraft);

  const setDraft = useCallback((patch: Partial<Draft>) => setDraftState((d) => ({ ...d, ...patch })), []);

  const pickCents = useCallback(
    (baseAmount: number) => {
      const now = Date.now();
      const used = new Set(
        Object.values(links)
          .filter((l) => l.baseAmount === baseAmount && l.expiresAt > now)
          .map((l) => l.cents),
      );
      const free = Array.from({ length: 99 }, (_, i) => i + 1).filter((c) => !used.has(c));
      return free.length ? free[Math.floor(Math.random() * free.length)] : null;
    },
    [links],
  );

  const createLink = useCallback((d: Draft, cents: number): LinkInfo => {
    const base = parseAmount(d.amount);
    const total = Math.round((base + cents / 100) * 100) / 100;
    const minutes = expiryOptions.find((e) => e.label === d.expiry)?.minutes ?? 30;
    const id = Math.random().toString(36).slice(2, 7);
    const now = Date.now();
    const link: LinkInfo = {
      id,
      item: d.item.trim(),
      reference: d.reference.trim(),
      baseAmount: base,
      cents,
      total,
      expiryLabel: d.expiry,
      createdAt: now,
      expiresAt: now + minutes * 60_000,
      url: `ceenit.app/pay/${id}`,
    };
    setLinks((l) => ({ ...l, [id]: link }));
    setTxns((t) => [
      {
        id,
        item: link.item,
        sub: `${link.reference || 'Waiting for payment'} · expires in ${d.expiry}`,
        amount: formatUsdt(total),
        status: 'Pending',
        group: 'Today',
      },
      ...t,
    ]);
    setDraftState(emptyDraft);
    return link;
  }, []);

  const getLink = useCallback((id: string) => links[id], [links]);

  const value = useMemo(
    () => ({ txns, draft, setDraft, pickCents, createLink, getLink }),
    [txns, draft, setDraft, pickCents, createLink, getLink],
  );
  return <LinksContext.Provider value={value}>{children}</LinksContext.Provider>;
}

export function useLinks() {
  const ctx = useContext(LinksContext);
  if (!ctx) throw new Error('useLinks must be used inside LinksProvider');
  return ctx;
}

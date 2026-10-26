export const formatUsdt = (n: number): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Placeholder rate. The real rate comes from a price service on the backend.
// The naira figure is always labelled as an estimate.
export const NGN_PER_USDT = 1600;

export const formatNaira = (usdt: number): string => {
  const v = usdt * NGN_PER_USDT;
  return v >= 1_000_000 ? `₦${(v / 1_000_000).toFixed(1)}M` : `₦${Math.round(v).toLocaleString('en-US')}`;
};

export const formatCountdown = (expiresAt: number, now: number): string | null => {
  const s = Math.floor((expiresAt - now) / 1000);
  if (s <= 0) return null;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (x: number) => String(x).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
};

export const formatDateTime = (ms: number): string =>
  new Date(ms).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });

export const shortTx = (tx: string): string => `${tx.slice(0, 4)}…${tx.slice(-4)}`;

/** Splits a wallet address into blocks of 4 so it is easier to read and check. */
export const groupAddress = (a: string): string => a.match(/.{1,4}/g)?.join(' ') ?? a;

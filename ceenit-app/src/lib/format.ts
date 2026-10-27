export const parseAmount = (s: string): number => {
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

export const formatUsdt = (n: number): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Fallback rate, used until the live Aboki Forex rate arrives (or when it cannot be reached).
// The naira figure is always shown as an estimate.
export const NGN_PER_USDT = 1600;

export const formatNaira = (usdt: number, rate: number = NGN_PER_USDT): string => {
  const v = usdt * rate;
  return v >= 1_000_000 ? `₦${(v / 1_000_000).toFixed(1)}M` : `₦${Math.round(v).toLocaleString('en-US')}`;
};

/** "mm:ss" or "h:mm:ss" until a time, or null once it has passed. */
export const formatCountdown = (expiresAt: number, now: number): string | null => {
  const s = Math.floor((expiresAt - now) / 1000);
  if (s <= 0) return null;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (x: number) => String(x).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
};

export const isTronAddress = (a: string): boolean => /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a);

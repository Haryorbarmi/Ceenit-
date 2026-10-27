import Constants from 'expo-constants';

// Where the Ceenit API lives. In development the app finds the computer running Expo and talks to
// port 4000 on it, so the address follows the Wi-Fi without any setup. In production set EXPO_PUBLIC_API_URL.
function baseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host ?? 'localhost'}:4000`;
}
export const API_URL = baseUrl();

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

let token: string | null = null;
export const setToken = (t: string | null) => { token = t; };

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('network', 'Could not reach Ceenit. Check your internet and try again.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? 'error', data.message ?? 'Something went wrong. Try again.', res.status);
  return data as T;
}

export type Method = 'phone' | 'email';

export type Me = {
  id: string;
  slug: string;
  shopName: string;
  fullName: string;
  category: string;
  city: string;
  contact: string;
  plan: string;
  /** When the paid month runs out. Empty for free sellers. */
  planUntil: string | null;
  /** The seller cancelled. The plan still runs until planUntil. */
  cancelled: boolean;
  /** A paid plan that has run out: the account can be read, but cannot create links. */
  planEnded: boolean;
  /** Subscribed sellers get the verified tick, can change their photo and collect likes. */
  /** Alert choices. Payment found is on by default; link expired is off by default. */
  /** A new wallet waiting to start, or null. */
  pendingWalletChange: { address: string; startsAt: string } | null;
  notifyDetected: boolean;
  notifyExpired: boolean;
  notifyBilling: boolean;
  subscribed: boolean;
  /** The shop photo, as a small image data URL. */
  photo: string | null;
  likes: number;
  wallet: string;
  link: string;
  freeUsed: number;
  freeTotal: number;
};

export type InvoiceStatus = 'pending' | 'confirming' | 'paid' | 'expired' | 'late' | 'underpaid' | 'overpaid';

export type Invoice = {
  id: string;
  item: string;
  reference: string;
  baseAmount: string;
  cents: number;
  amount: string;
  status: InvoiceStatus;
  expiresAt: string;
  createdAt: string;
  paidAt: string | null;
  nextId: string | null;
  requestCount: number;
  url: string;
};

export type InvoicePayment = {
  txId: string;
  outcome: string;
  amount: string;
  confirmations: number;
  confirmed: boolean;
  success: boolean | null;
  resolved: boolean;
  at: string;
};

export type LinkRequest = { id: string; invoiceId: string; buyerName: string; item: string; previousAmount: string; requestsMade: number; at: string };

export type AppNotification = { id: string; type: string; title: string; body: string; invoiceId: string | null; at: string; read: boolean };
export type Inbox = { unread: number; items: AppNotification[] };

export type BillingPayment = { reference: string; plan: string; amountKobo: number; at: string };
export type DeviceSession = { id: string; device: string; lastActive: string; current: boolean };

export const api = {
  requestCode: (method: Method, contact: string) => request<{ sent: boolean; devCode?: string }>('POST', '/v1/auth/request-code', { method, contact }),
  verifyCode: (method: Method, contact: string, code: string, device?: string) => request<{ token: string; hasAccount: boolean }>('POST', '/v1/auth/verify-code', { method, contact, code, device }),
  walletValid: (address: string) => request<{ valid: boolean }>('GET', `/v1/wallets/${encodeURIComponent(address)}/check`),
  linkNameAvailable: (name: string) => request<{ available: boolean }>('GET', `/v1/link-names/${encodeURIComponent(name)}`),
  register: (b: { method: Method; fullName: string; shopName: string; category: string; city: string; linkName: string; wallet: string }) => request<Me>('POST', '/v1/sellers', b),
  rate: () => request<{ ngnPerUsdt: number }>('GET', '/v1/rate'),
  me: () => request<Me>('GET', '/v1/me'),
  setPhoto: (photo: string | null) => request<Me>('POST', '/v1/me/photo', { photo }),
  sessions: () => request<DeviceSession[]>('GET', '/v1/sessions'),
  revokeSession: (id: string) => request<{ ok: boolean }>('POST', `/v1/sessions/${encodeURIComponent(id)}/revoke`, {}),
  walletRequestCode: () => request<{ sent: boolean; devCode?: string }>('POST', '/v1/wallet/request-code', {}),
  changeWallet: (address: string, code: string) => request<Me>('POST', '/v1/wallet/change', { address, code }),
  cancelWalletChange: () => request<Me>('POST', '/v1/wallet/change/cancel', {}),
  logoutAll: () => request<{ ok: boolean }>('POST', '/v1/auth/logout-all'),
  checkout: (plan: 'seller' | 'business') => request<{ url: string; reference: string }>('POST', '/v1/billing/checkout', { plan }),
  verifyBilling: (reference: string) => request<{ active: boolean }>('POST', '/v1/billing/verify', { reference }),
  billingHistory: () => request<BillingPayment[]>('GET', '/v1/billing/history'),
  cancelBilling: () => request<{ ok: boolean }>('POST', '/v1/billing/cancel', {}),
  setNotifyPrefs: (p: { detected?: boolean; expired?: boolean; billing?: boolean }) => request<Me>('POST', '/v1/me/notifications', p),
  notifications: () => request<Inbox>('GET', '/v1/notifications'),
  markNotificationsRead: () => request<{ ok: boolean }>('POST', '/v1/notifications/read', {}),
  registerPushToken: (token: string) => request<{ ok: boolean }>('POST', '/v1/push-token', { token }),
  removePushToken: (token: string) => request<{ ok: boolean }>('POST', '/v1/push-token/remove', { token }),
  invoices: () => request<Invoice[]>('GET', '/v1/invoices'),
  invoice: (id: string) => request<Invoice & { payments: InvoicePayment[] }>('GET', `/v1/invoices/${id}`),
  createInvoice: (b: { item: string; amount: string; reference?: string; expiryMinutes: number }) =>
    request<Invoice>('POST', '/v1/invoices', { ...b, acknowledgedNoCancel: true }),
  resolvePayment: (txId: string) => request<{ ok: boolean }>('POST', `/v1/payments/${txId}/resolve`),
  linkRequests: () => request<LinkRequest[]>('GET', '/v1/link-requests'),
  approveRequest: (id: string) => request<Invoice>('POST', `/v1/link-requests/${id}/approve`, {}),
  declineRequest: (id: string) => request<{ ok: boolean }>('POST', `/v1/link-requests/${id}/decline`, {}),
};

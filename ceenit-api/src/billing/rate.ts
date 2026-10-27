// The naira estimate for one USDT, from Monierate (docs.monierate.com, key in MONIERATE_API_KEY).
// Each request costs ₦10 from the Monierate wallet, so we ask at most once an hour and share the answer with everyone.
// We use the "parallel" (street) market, because that is the rate people actually buy and sell USDT at in Nigeria.

export const FALLBACK_NGN_PER_USDT = 1600;
const URL = 'https://api.monierate.com/core/rates/latest.json?base=USDT&quote=NGN&market=parallel';
const FRESH_MS = 60 * 60_000;

export type Rate = { ngnPerUsdt: number; updatedAt: string | null; source: 'monierate' | 'default' };

export class RateService {
  private last: Rate | null = null;
  private fetchedAt = 0;
  private inflight: Promise<void> | null = null;

  constructor(private apiKey: string, private doFetch: typeof fetch = fetch) {}

  async get(): Promise<Rate> {
    if (Date.now() - this.fetchedAt > FRESH_MS) {
      this.inflight ??= this.refresh().finally(() => { this.inflight = null; });
      await this.inflight;
    }
    return this.last ?? { ngnPerUsdt: FALLBACK_NGN_PER_USDT, updatedAt: null, source: 'default' };
  }

  private async refresh() {
    // Even a failed try waits for the next window, so an outage does not drain the wallet. The last good rate keeps being served.
    this.fetchedAt = Date.now();
    try {
      const res = await this.doFetch(URL, { headers: { api_key: this.apiKey, Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`Monierate returned ${res.status}`);
      const body = (await res.json()) as { status?: string; data?: { timestamp?: number; rates?: unknown } };
      const rate = body.data?.rates;
      if (body.status !== 'success' || typeof rate !== 'number' || !(rate > 100 && rate < 10_000)) throw new Error('Monierate answer had no usable NGN rate');
      this.last = { ngnPerUsdt: Math.round(rate * 100) / 100, updatedAt: new Date(body.data?.timestamp ?? Date.now()).toISOString(), source: 'monierate' };
    } catch (e) {
      console.error('[rate]', (e as Error).message);
    }
  }
}

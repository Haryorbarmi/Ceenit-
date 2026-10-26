import type { Blocks, TronClient, Transfer, TxInfo } from './types';

// Talks to TronGrid (the public TRON node service). Works for mainnet and the Nile test network.
// An API key is optional but recommended: without one TronGrid limits how often you can ask.

type TransferRow = {
  transaction_id: string;
  from: string;
  to: string;
  value: string;
  block_timestamp: number;
  token_info?: { address?: string };
};

export class TronGridClient implements TronClient {
  constructor(
    private host: string,
    private usdtContract: string,
    private apiKey?: string,
  ) {}

  private headers(): Record<string, string> {
    return { 'Content-Type': 'application/json', ...(this.apiKey ? { 'TRON-PRO-API-KEY': this.apiKey } : {}) };
  }

  /** Asks TronGrid, and waits and tries again if it says "too many requests" (429) or has a short hiccup. */
  private async request(url: string, init: RequestInit, label: string): Promise<any> {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(url, { ...init, headers: this.headers(), signal: AbortSignal.timeout(10_000) });
      if (res.ok) return res.json();
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= 4) throw new Error(`TronGrid ${res.status} for ${label}`);
      await new Promise((r) => setTimeout(r, 600 * 2 ** attempt)); // 0.6s, 1.2s, 2.4s, 4.8s
    }
  }

  private get(url: string): Promise<any> {
    return this.request(url, {}, url.split('?')[0]!);
  }

  private post(path: string, body?: unknown): Promise<any> {
    return this.request(this.host + path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }, path);
  }

  private blocksCache?: { at: number; value: Blocks };

  async listIncomingTransfers(wallet: string, sinceMs: number): Promise<Transfer[]> {
    const q = new URLSearchParams({
      only_to: 'true',
      contract_address: this.usdtContract,
      min_timestamp: String(Math.max(0, Math.floor(sinceMs))),
      order_by: 'block_timestamp,asc',
      limit: '200',
    });
    let url: string | undefined = `${this.host}/v1/accounts/${wallet}/transactions/trc20?${q}`;
    const out: Transfer[] = [];
    for (let page = 0; url && page < 5; page++) {
      const json = await this.get(url);
      for (const r of (json.data ?? []) as TransferRow[]) {
        if (!/^\d+$/.test(r.value)) continue;
        out.push({
          txId: r.transaction_id,
          from: r.from,
          to: r.to,
          amountMicro: BigInt(r.value),
          blockTimeMs: r.block_timestamp,
          contract: r.token_info?.address ?? '',
        });
      }
      url = json.meta?.links?.next;
    }
    return out;
  }

  async getTxInfo(txId: string): Promise<TxInfo | null> {
    const j = await this.post('/wallet/gettransactioninfobyid', { value: txId });
    // The node answers {} while it has not seen the transaction yet.
    if (!j || typeof j.blockNumber !== 'number') return null;
    return {
      txId,
      blockNumber: j.blockNumber,
      success: j.receipt?.result === 'SUCCESS',
      logs: ((j.log ?? []) as { address: string; topics: string[]; data: string }[]).map((l) => ({
        addressHex: l.address.toLowerCase(),
        topics: l.topics.map((t) => t.toLowerCase()),
        dataHex: l.data.toLowerCase(),
      })),
    };
  }

  async getBlocks(): Promise<Blocks> {
    // A block takes 3 seconds, so a 2 second memory saves calls without going stale.
    if (this.blocksCache && Date.now() - this.blocksCache.at < 2000) return this.blocksCache.value;
    const [now, solid] = await Promise.all([this.post('/wallet/getnowblock'), this.post('/walletsolidity/getnowblock')]);
    const value = { current: now.block_header.raw_data.number, solidified: solid.block_header.raw_data.number };
    this.blocksCache = { at: Date.now(), value };
    return value;
  }
}

import { randomBytes } from 'node:crypto';
import { addressToHex20 } from './address';
import { TRANSFER_TOPIC } from './logs';
import type { Blocks, TronClient, Transfer, TxInfo, TxLog } from './types';

type Stored = Transfer & { blockNumber: number; success: boolean; logs: TxLog[] };

/**
 * A pretend TRON network for tests and local development.
 * It can send USDT, mine blocks, send fake tokens and failing transactions, so every case can be tried without real money.
 * The list of transfers deliberately ignores the token contract, as a faulty or hostile service might,
 * so the watcher must catch fake tokens by reading the transaction itself.
 */
export class FakeTron implements TronClient {
  blocks: Blocks = { current: 1000, solidified: 981 };
  private txs = new Map<string, Stored>();
  constructor(private usdtContract: string) {}

  /** Send a token transfer. Returns the transaction id. */
  sendUsdt(p: { from: string; to: string; amountMicro: bigint; contract?: string; success?: boolean; blockTimeMs?: number }): string {
    const contract = p.contract ?? this.usdtContract;
    const txId = randomBytes(32).toString('hex');
    const blockNumber = ++this.blocks.current;
    const pad = (hex20: string) => hex20.padStart(64, '0');
    const logs: TxLog[] = [
      {
        addressHex: addressToHex20(contract),
        topics: [TRANSFER_TOPIC, pad(addressToHex20(p.from)), pad(addressToHex20(p.to))],
        dataHex: p.amountMicro.toString(16).padStart(64, '0'),
      },
    ];
    this.txs.set(txId, {
      txId,
      from: p.from,
      to: p.to,
      amountMicro: p.amountMicro,
      blockTimeMs: p.blockTimeMs ?? Date.now(),
      contract,
      blockNumber,
      success: p.success ?? true,
      logs: p.success === false ? [] : logs,
    });
    return txId;
  }

  /** Add blocks. TRON treats a block as final once it is about 19 blocks old. */
  mine(n: number): void {
    this.blocks.current += n;
    this.blocks.solidified = this.blocks.current - 19;
  }

  async listIncomingTransfers(wallet: string, sinceMs: number): Promise<Transfer[]> {
    return [...this.txs.values()].filter((t) => t.to === wallet && t.blockTimeMs >= sinceMs).sort((a, b) => a.blockTimeMs - b.blockTimeMs);
  }

  async getTxInfo(txId: string): Promise<TxInfo | null> {
    const t = this.txs.get(txId);
    return t ? { txId, blockNumber: t.blockNumber, success: t.success, logs: t.logs } : null;
  }

  async getBlocks(): Promise<Blocks> {
    return { ...this.blocks };
  }
}

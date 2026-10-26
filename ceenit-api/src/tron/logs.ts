import type { TxLog } from './types';

/** The fingerprint of an ERC20/TRC20 "Transfer(from, to, amount)" event. */
export const TRANSFER_TOPIC = 'ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export type OnChainTransfer = {
  /** The token contract that emitted the event, as 20-byte hex. This is what proves which token it was. */
  contractHex: string;
  fromHex: string;
  toHex: string;
  amountMicro: bigint;
};

/** Reads token transfers straight out of a transaction's own event logs. This is the source of truth, not any list. */
export function parseTransfers(logs: TxLog[]): OnChainTransfer[] {
  const out: OnChainTransfer[] = [];
  for (const l of logs) {
    if (l.topics.length !== 3 || l.topics[0] !== TRANSFER_TOPIC || !/^[0-9a-f]{64}$/.test(l.dataHex)) continue;
    out.push({
      contractHex: l.addressHex,
      fromHex: l.topics[1]!.slice(-40),
      toHex: l.topics[2]!.slice(-40),
      amountMicro: BigInt('0x' + l.dataHex),
    });
  }
  return out;
}

import { addressToHex20 } from '../tron/address';
import { parseTransfers } from '../tron/logs';
import type { Blocks, TxInfo } from '../tron/types';

/**
 * The six checks. A payment is only marked Paid when every one passes.
 * 1. Real USDT, from the official contract (blocks fake tokens)
 * 2. Landed in this seller's wallet
 * 3. The exact amount (the unique cents match this invoice)
 * 4. The transaction ran successfully
 * 5. Confirmed: its block is final on TRON
 * 6. This transaction was never used for another payment
 */
export type Checks = {
  officialContract: boolean;
  rightWallet: boolean;
  exactAmount: boolean;
  succeeded: boolean;
  confirmed: boolean;
  notUsedBefore: boolean;
};

export const checkLabels: Record<keyof Checks, string> = {
  officialContract: 'Real USDT from the official contract',
  rightWallet: "Landed in this seller's wallet",
  exactAmount: 'Exact amount',
  succeeded: 'Transaction marked successful',
  confirmed: 'Confirmed on the blockchain',
  notUsedBefore: 'Transaction used only once',
};

/** What actually arrived: official-USDT transfers to this wallet inside the transaction. Null if there were none. */
export function receivedFromLogs(info: TxInfo, walletAddress: string, usdtContract: string): bigint | null {
  const walletHex = addressToHex20(walletAddress);
  const usdtHex = addressToHex20(usdtContract);
  const mine = parseTransfers(info.logs).filter((t) => t.contractHex === usdtHex && t.toHex === walletHex);
  return mine.length ? mine.reduce((sum, t) => sum + t.amountMicro, 0n) : null;
}

export function runChecks(p: {
  walletAddress: string;
  amountMicro: bigint;
  usdtContract: string;
  info: TxInfo | null;
  blocks: Blocks;
  alreadyUsed: boolean;
}): { checks: Checks; passed: boolean; failed: (keyof Checks)[] } {
  const walletHex = addressToHex20(p.walletAddress);
  const usdtHex = addressToHex20(p.usdtContract);
  const transfers = p.info ? parseTransfers(p.info.logs) : [];
  const official = transfers.filter((t) => t.contractHex === usdtHex);
  const toWallet = official.filter((t) => t.toHex === walletHex);
  const received = toWallet.reduce((sum, t) => sum + t.amountMicro, 0n);

  const checks: Checks = {
    officialContract: official.length > 0,
    rightWallet: toWallet.length > 0,
    exactAmount: toWallet.length > 0 && received === p.amountMicro,
    succeeded: !!p.info?.success,
    confirmed: !!p.info && p.info.blockNumber <= p.blocks.solidified,
    notUsedBefore: !p.alreadyUsed,
  };
  const failed = (Object.keys(checks) as (keyof Checks)[]).filter((k) => !checks[k]);
  return { checks, passed: failed.length === 0, failed };
}

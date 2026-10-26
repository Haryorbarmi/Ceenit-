// What the watcher needs from the TRON network. Real and fake versions both follow this shape,
// so the same watcher code runs against the live chain, the test network, or a simulation.

/** A USDT transfer seen arriving at a wallet (from the transfer list). The watcher re-checks it against the transaction itself. */
export type Transfer = {
  txId: string;
  from: string;
  to: string;
  amountMicro: bigint;
  blockTimeMs: number;
  /** Contract the listing says the token belongs to. Only used to filter. The real check reads the transaction log. */
  contract: string;
};

/** One event log from a transaction, as the node reports it (hex, no 0x). */
export type TxLog = { addressHex: string; topics: string[]; dataHex: string };

export type TxInfo = {
  txId: string;
  blockNumber: number;
  /** The transaction ran without error. A failed transaction moves no money even though it is on the chain. */
  success: boolean;
  logs: TxLog[];
};

export type Blocks = {
  /** Latest block. */
  current: number;
  /** Latest block TRON treats as final (about 19 blocks behind). Anything at or below this cannot be reversed. */
  solidified: number;
};

export interface TronClient {
  /** USDT transfers into a wallet since a time, oldest first. */
  listIncomingTransfers(wallet: string, sinceMs: number): Promise<Transfer[]>;
  getTxInfo(txId: string): Promise<TxInfo | null>;
  getBlocks(): Promise<Blocks>;
}

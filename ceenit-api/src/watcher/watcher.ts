import { classify, InvoiceLite } from '../domain/match';
import { Ctx } from '../domain/context';
import { applyDueWalletChanges } from '../domain/wallet';
import { receivedFromLogs, runChecks } from '../domain/verify';
import { formatUsdt } from '../money';
import type { Transfer } from '../tron/types';

/**
 * The blockchain watcher. Every few seconds it:
 *  1. marks links that ran out of time as expired
 *  2. looks at every wallet that has an open (or recently expired) link, and finds new USDT transfers into it
 *  3. for each new transfer, reads the transaction itself, decides which invoice it belongs to, and records it
 *  4. follows each recorded payment until TRON marks its block final, then runs all six checks and marks the invoice Paid
 *
 * Every step is safe to run twice. A transaction can only be recorded once (it is the primary key of `payments`),
 * which is the sixth check.
 */
export class Watcher {
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private ctx: Ctx) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), this.ctx.cfg.pollMs);
    void this.tick();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  /** One full pass. Exposed so tests can run it by hand. */
  async tick(): Promise<void> {
    if (this.running) return; // never overlap two passes
    this.running = true;
    try {
      await this.sweepExpired();
      await this.scanWallets();
      await this.refreshConfirmations();
    } catch (e) {
      console.error('[watcher] pass failed, will retry:', e instanceof Error ? e.message : e);
    } finally {
      this.running = false;
    }
  }

  private async sweepExpired(): Promise<void> {
    await applyDueWalletChanges(this.ctx);
    const expired = await this.ctx.db.query<{ id: string; seller_id: string }>(`update invoices set status = 'expired' where status = 'pending' and expires_at < now() returning id, seller_id`);
    for (const i of expired) await this.ctx.notifier.notify({ type: 'invoice_expired', sellerId: i.seller_id, invoiceId: i.id });
  }

  private async scanWallets(): Promise<void> {
    const { db, cfg, tron } = this.ctx;
    const wallets = await db.query<{ wallet_address: string; since: Date }>(
      `select wallet_address, min(created_at) as since from invoices
        where status in ('pending', 'confirming', 'expired') and expires_at + ($1::float8 * interval '1 millisecond') > now()
        group by wallet_address`,
      [cfg.lateWindowMs],
    );
    for (const w of wallets) {
      let transfers: Transfer[];
      try {
        transfers = await tron.listIncomingTransfers(w.wallet_address, w.since.getTime() - 60_000);
      } catch (e) {
        console.error(`[watcher] could not list transfers for ${w.wallet_address}:`, e instanceof Error ? e.message : e);
        continue;
      }
      for (const t of transfers) {
        const [seen] = await db.query(`select 1 from payments where tx_id = $1`, [t.txId]);
        if (!seen) await this.handleNewTransfer(w.wallet_address, t);
      }
    }
  }

  private async handleNewTransfer(wallet: string, t: Transfer): Promise<void> {
    const { db, cfg, tron, notifier } = this.ctx;
    const info = await tron.getTxInfo(t.txId);
    if (!info) return; // the node has not seen it yet. Try again next pass.
    const blocks = await tron.getBlocks();

    const received = receivedFromLogs(info, wallet, cfg.usdtContract);
    if (received === null) {
      // The list said USDT, but the transaction itself shows no official USDT arriving. Treat it as fake and remember it.
      const { checks } = runChecks({ walletAddress: wallet, amountMicro: t.amountMicro, usdtContract: cfg.usdtContract, info, blocks, alreadyUsed: false });
      await db.query(
        `insert into payments (tx_id, wallet_address, from_address, amount_micro, block_number, block_time, outcome, success, checks, reason)
         values ($1, $2, $3, $4::bigint, $5, $6, 'rejected', $7, $8::jsonb, $9) on conflict do nothing`,
        [t.txId, wallet, t.from, t.amountMicro.toString(), info.blockNumber, new Date(t.blockTimeMs).toISOString(), info.success, JSON.stringify(checks), 'No official USDT arrived in this wallet.'],
      );
      return;
    }

    const rows = await db.query<{ id: string; status: string; amount_micro: string; created_at: Date; expires_at: Date; seller_id: string }>(
      `select id, status, amount_micro::text as amount_micro, created_at, expires_at, seller_id from invoices
        where wallet_address = $1 and status in ('pending', 'expired') and expires_at + ($2::float8 * interval '1 millisecond') > $3::timestamptz`,
      [wallet, cfg.lateWindowMs, new Date(t.blockTimeMs).toISOString()],
    );
    const lite: InvoiceLite[] = rows.map((r) => ({
      id: r.id,
      status: r.status,
      amountMicro: BigInt(r.amount_micro),
      createdAtMs: r.created_at.getTime(),
      expiresAtMs: r.expires_at.getTime(),
    }));
    const outcome = classify({ receivedMicro: received, atMs: t.blockTimeMs, invoices: lite, lateWindowMs: cfg.lateWindowMs });
    const invoice = 'invoiceId' in outcome ? rows.find((r) => r.id === outcome.invoiceId) : undefined;
    const confirmations = Math.max(0, Math.min(cfg.confirmationsShown, blocks.current - info.blockNumber + 1));
    const { checks } = runChecks({
      walletAddress: wallet,
      amountMicro: invoice ? BigInt(invoice.amount_micro) : received,
      usdtContract: cfg.usdtContract,
      info,
      blocks,
      alreadyUsed: false,
    });

    let inserted = false;
    await db.transaction(async (tx) => {
      const res = await tx.query(
        `insert into payments (tx_id, wallet_address, invoice_id, from_address, amount_micro, block_number, block_time, outcome, success, confirmations, checks)
         values ($1, $2, $3, $4, $5::bigint, $6, $7, $8, $9, $10, $11::jsonb) on conflict do nothing returning tx_id`,
        [t.txId, wallet, invoice?.id ?? null, t.from, received.toString(), info.blockNumber, new Date(t.blockTimeMs).toISOString(), outcome.kind, info.success, confirmations, JSON.stringify(checks)],
      );
      inserted = res.length > 0;
      if (!inserted || !invoice) return;
      if (outcome.kind === 'paid') await tx.query(`update invoices set status = 'confirming' where id = $1 and status = 'pending'`, [invoice.id]);
      else if (outcome.kind !== 'unmatched') await tx.query(`update invoices set status = $2 where id = $1 and status in ('pending', 'expired')`, [invoice.id, outcome.kind]);
    });
    if (!inserted) return;

    const amountText = `${formatUsdt(received)} USDT`;
    if (outcome.kind === 'paid' && invoice) await notifier.notify({ type: 'payment_detected', sellerId: invoice.seller_id, invoiceId: invoice.id, detail: amountText });
    else if (outcome.kind === 'unmatched') {
      const [w] = await db.query<{ seller_id: string }>(`select seller_id from invoices where wallet_address = $1 limit 1`, [wallet]);
      if (w) await notifier.notify({ type: 'payment_unmatched', sellerId: w.seller_id, detail: amountText });
    } else if (invoice) await notifier.notify({ type: 'payment_flagged', sellerId: invoice.seller_id, invoiceId: invoice.id, detail: `${outcome.kind}: ${amountText}` });
  }

  /** Follow every payment that is not final yet. When TRON marks its block final, run all six checks. */
  private async refreshConfirmations(): Promise<void> {
    const { db, cfg, tron, notifier } = this.ctx;
    const pending = await db.query<{ tx_id: string; wallet_address: string; invoice_id: string | null; outcome: string; amount_micro: string; inv_amount: string | null; seller_id: string | null }>(
      `select p.tx_id, p.wallet_address, p.invoice_id, p.outcome, p.amount_micro::text as amount_micro,
              i.amount_micro::text as inv_amount, i.seller_id
         from payments p left join invoices i on i.id = p.invoice_id
        where not p.confirmed and p.outcome <> 'rejected'`,
    );
    if (!pending.length) return;
    const blocks = await tron.getBlocks();

    for (const p of pending) {
      const info = await tron.getTxInfo(p.tx_id);
      if (!info) continue;
      const confirmations = Math.max(0, Math.min(cfg.confirmationsShown, blocks.current - info.blockNumber + 1));
      const final = info.blockNumber <= blocks.solidified;
      const { checks, passed } = runChecks({
        walletAddress: p.wallet_address,
        amountMicro: p.inv_amount ? BigInt(p.inv_amount) : BigInt(p.amount_micro),
        usdtContract: cfg.usdtContract,
        info,
        blocks,
        alreadyUsed: false, // this transaction is in `payments` exactly once, which is what check 6 means
      });

      if (!final) {
        await db.query(`update payments set confirmations = $2, success = $3, checks = $4::jsonb, updated_at = now() where tx_id = $1`, [p.tx_id, confirmations, info.success, JSON.stringify(checks)]);
        continue;
      }

      await db.transaction(async (tx) => {
        await tx.query(`update payments set confirmations = $2, confirmed = true, success = $3, checks = $4::jsonb, updated_at = now() where tx_id = $1`, [p.tx_id, cfg.confirmationsShown, info.success, JSON.stringify(checks)]);
        if (p.outcome === 'paid' && p.invoice_id) {
          if (passed) await tx.query(`update invoices set status = 'paid', paid_at = now() where id = $1 and status = 'confirming'`, [p.invoice_id]);
          // The transaction failed on chain. No money moved, so the link goes back to waiting (or expired if its time is up).
          else await tx.query(`update invoices set status = case when expires_at > now() then 'pending' else 'expired' end where id = $1 and status = 'confirming'`, [p.invoice_id]);
        }
      });
      if (p.outcome === 'paid' && passed && p.seller_id) {
        await notifier.notify({ type: 'payment_confirmed', sellerId: p.seller_id, invoiceId: p.invoice_id ?? undefined, detail: `${formatUsdt(BigInt(p.amount_micro))} USDT` });
      }
    }
  }
}

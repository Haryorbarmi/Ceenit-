import { isValidTronAddress } from '../tron/address';
import { AppError, Ctx } from './context';
import { newId } from './invoices';
import { consumeCode } from './sellers';

// Changing the wallet is a protected action: the seller proves it is them with a code, then the new wallet waits
// (24 hours by default) before it starts. Links made before it starts keep paying the old wallet. It can be cancelled while it waits.

const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

export type PendingWalletChange = { address: string; startsAt: string };

export async function pendingWalletChange(ctx: Ctx, sellerId: string): Promise<PendingWalletChange | null> {
  const [r] = await ctx.db.query<{ new_address: string; starts_at: Date }>(`select new_address, starts_at from wallet_changes where seller_id = $1 and status = 'pending'`, [sellerId]);
  return r ? { address: r.new_address, startsAt: r.starts_at.toISOString() } : null;
}

export async function requestWalletChange(ctx: Ctx, seller: { id: string; contact: string; wallet: string }, address: string, code: string): Promise<PendingWalletChange> {
  const next = address.trim();
  if (!isValidTronAddress(next)) throw new AppError('invalid_wallet', 400, 'This is not a valid TRON (TRC20) address.');
  if (next === seller.wallet) throw new AppError('same_wallet', 400, 'That is already your wallet.');
  if (await pendingWalletChange(ctx, seller.id)) throw new AppError('change_pending', 409, 'A wallet change is already waiting. Cancel it first.');
  const [taken] = await ctx.db.query(`select 1 from wallets where address = $1 and active and seller_id <> $2`, [next, seller.id]);
  if (taken) throw new AppError('wallet_in_use', 409, 'That wallet belongs to another Ceeneet account.');

  await consumeCode(ctx, seller.contact, code);
  const hours = ctx.cfg.walletChangeHours;
  const [row] = await ctx.db.query<{ starts_at: Date }>(
    `insert into wallet_changes (id, seller_id, new_address, starts_at) values ($1, $2, $3, now() + ($4::float8 * interval '1 hour')) returning starts_at`,
    [newId(12), seller.id, next, hours],
  );
  await ctx.notifier.notify({ type: 'wallet_change_requested', sellerId: seller.id, detail: short(next) });
  return { address: next, startsAt: row!.starts_at.toISOString() };
}

export async function cancelWalletChange(ctx: Ctx, sellerId: string): Promise<void> {
  await ctx.db.query(`update wallet_changes set status = 'cancelled' where seller_id = $1 and status = 'pending'`, [sellerId]);
}

/** Called by the watcher: any change whose wait is over becomes the active wallet. */
export async function applyDueWalletChanges(ctx: Ctx): Promise<void> {
  const due = await ctx.db.query<{ id: string; seller_id: string; new_address: string }>(`select id, seller_id, new_address from wallet_changes where status = 'pending' and starts_at <= now()`);
  for (const c of due) {
    await ctx.db.transaction(async (tx) => {
      await tx.query(`update wallets set active = false where seller_id = $1 and active`, [c.seller_id]);
      await tx.query(`insert into wallets (id, seller_id, address) values ($1, $2, $3)`, [newId(12), c.seller_id, c.new_address]);
      await tx.query(`update wallet_changes set status = 'applied' where id = $1`, [c.id]);
    });
    await ctx.notifier.notify({ type: 'wallet_changed', sellerId: c.seller_id, detail: short(c.new_address) });
  }
}

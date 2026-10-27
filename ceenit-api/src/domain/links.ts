import { formatUsdt } from '../money';
import { AppError, Ctx } from './context';
import { createInvoice, EXPIRY_OPTIONS, INVOICE_COLS, InvoiceRow, newId } from './invoices';

/** What the buyer's page needs. Matches the shape the web page already uses. */
export type PublicInvoice = {
  id: string;
  seller: { slug: string; name: string; category: string; city: string; since: string; phone: string | null };
  item: string;
  amount: string;
  network: 'TRON (TRC20)';
  wallet: string;
  expiresAt: number;
  status: 'waiting' | 'confirming' | 'paid' | 'expired' | 'requested' | 'late' | 'underpaid' | 'overpaid';
  confirmationsDone: number;
  confirmationsTotal: number;
  txId?: string;
  paidAt?: number;
  received?: string;
  receivedAt?: number;
  requestCount: number;
  nextId?: string;
};

export async function publicInvoice(ctx: Ctx, id: string): Promise<PublicInvoice> {
  const [r] = await ctx.db.query<InvoiceRow & { slug: string; shop_name: string; category: string; city: string; seller_since: Date; contact: string; contact_method: string }>(
    `select ${INVOICE_COLS.split(',').map((c) => 'i.' + c.trim()).join(', ')}, s.slug, s.shop_name, s.category, s.city, s.created_at as seller_since, s.contact, s.contact_method
       from invoices i join sellers s on s.id = i.seller_id where i.id = $1`,
    [id],
  );
  if (!r) throw new AppError('not_found', 404);

  const [pay] = await ctx.db.query<{ tx_id: string; amount_micro: string; confirmations: number; block_time: Date; outcome: string }>(
    `select tx_id, amount_micro::text as amount_micro, confirmations, block_time, outcome from payments where invoice_id = $1 order by created_at desc limit 1`,
    [id],
  );
  const [req] = await ctx.db.query(`select 1 from link_requests where invoice_id = $1 and status = 'pending'`, [id]);

  let status: PublicInvoice['status'];
  const raw = r.status === 'pending' && r.expires_at.getTime() < Date.now() ? 'expired' : r.status;
  if (raw === 'pending') status = 'waiting';
  else if (raw === 'expired') status = req ? 'requested' : r.next_id ? 'requested' : 'expired';
  else status = raw as PublicInvoice['status'];

  const flagged = status === 'late' || status === 'underpaid' || status === 'overpaid';
  return {
    id: r.id,
    seller: {
      slug: r.slug,
      name: r.shop_name,
      category: r.category,
      city: r.city,
      since: r.seller_since.toLocaleString('en-GB', { month: 'long', year: 'numeric' }),
      phone: r.contact_method === 'phone' ? r.contact : null,
    },
    item: r.item,
    amount: formatUsdt(BigInt(r.amount_micro)),
    network: 'TRON (TRC20)',
    wallet: r.wallet_address,
    expiresAt: r.expires_at.getTime(),
    status,
    confirmationsDone: status === 'paid' ? ctx.cfg.confirmationsShown : pay?.confirmations ?? 0,
    confirmationsTotal: ctx.cfg.confirmationsShown,
    txId: status === 'paid' || flagged ? pay?.tx_id : undefined,
    paidAt: r.paid_at?.getTime(),
    received: flagged && pay ? formatUsdt(BigInt(pay.amount_micro)) : undefined,
    receivedAt: pay?.block_time.getTime(),
    requestCount: r.request_count,
    nextId: r.next_id ?? undefined,
  };
}

const MAX_REQUESTS = 3;

/** The buyer asks the seller for a fresh link. Only possible once the link has expired. */
export async function requestNewLink(ctx: Ctx, invoiceId: string, buyerName: string) {
  const [r] = await ctx.db.query<{ id: string; seller_id: string; status: string; expires_at: Date; request_count: number }>(
    `select id, seller_id, status, expires_at, request_count from invoices where id = $1`,
    [invoiceId],
  );
  if (!r) throw new AppError('not_found', 404);
  const expired = r.status === 'expired' || (r.status === 'pending' && r.expires_at.getTime() < Date.now());
  if (!expired) throw new AppError('not_expired', 409, 'This link is still active.');

  const [open] = await ctx.db.query(`select 1 from link_requests where invoice_id = $1 and status = 'pending'`, [invoiceId]);
  if (open) return; // a repeat tap does not use up another request
  if (r.request_count >= MAX_REQUESTS) throw new AppError('limit', 429, 'Request limit reached. Please message the seller.');

  await ctx.db.transaction(async (tx) => {
    await tx.query(`update invoices set status = 'expired', request_count = request_count + 1 where id = $1`, [invoiceId]);
    await tx.query(`insert into link_requests (id, invoice_id, buyer_name) values ($1, $2, $3)`, [newId(10), invoiceId, buyerName.trim().slice(0, 80)]);
  });
  await ctx.notifier.notify({ type: 'link_requested', sellerId: r.seller_id, invoiceId, detail: buyerName.trim() });
}

export async function listRequests(ctx: Ctx, sellerId: string) {
  return ctx.db.query<{ id: string; invoice_id: string; buyer_name: string; status: string; created_at: Date; item: string; old_amount: string; request_count: number }>(
    `select q.id, q.invoice_id, q.buyer_name, q.status, q.created_at, i.item, i.amount_micro::text as old_amount, i.request_count
       from link_requests q join invoices i on i.id = q.invoice_id where i.seller_id = $1 and q.status = 'pending' order by q.created_at desc`,
    [sellerId],
  );
}

/** The seller approves: a fresh invoice with the same item, new cents and a new expiry. The old one stays on record as expired. */
export async function approveRequest(ctx: Ctx, sellerId: string, requestId: string, opts: { amount?: string; expiryMinutes?: number }) {
  const [q] = await ctx.db.query<{ id: string; invoice_id: string; status: string; item: string; base_micro: string; expiry_minutes: number; reference: string }>(
    `select q.id, q.invoice_id, q.status, i.item, i.base_micro::text as base_micro, i.expiry_minutes, i.buyer_reference as reference
       from link_requests q join invoices i on i.id = q.invoice_id where q.id = $1 and i.seller_id = $2`,
    [requestId, sellerId],
  );
  if (!q) throw new AppError('not_found', 404);
  if (q.status !== 'pending') throw new AppError('already_handled', 409);
  const expiry = opts.expiryMinutes ?? q.expiry_minutes;
  if (!(EXPIRY_OPTIONS as readonly number[]).includes(expiry)) throw new AppError('invalid_expiry', 400);

  const fresh = await createInvoice(ctx, {
    sellerId,
    item: q.item,
    amount: opts.amount ?? formatUsdt(BigInt(q.base_micro)),
    reference: q.reference,
    expiryMinutes: expiry,
    ack: true, // approving is the seller's own decision, made on a screen that says the link cannot be cancelled
    parentId: q.invoice_id,
  });
  await ctx.db.transaction(async (tx) => {
    await tx.query(`update link_requests set status = 'approved', new_invoice_id = $2 where id = $1`, [requestId, fresh.id]);
    await tx.query(`update invoices set next_id = $2 where id = $1`, [q.invoice_id, fresh.id]);
  });
  return fresh;
}

export async function declineRequest(ctx: Ctx, sellerId: string, requestId: string) {
  const res = await ctx.db.query(
    `update link_requests q set status = 'declined' from invoices i
      where q.id = $1 and i.id = q.invoice_id and i.seller_id = $2 and q.status = 'pending' returning q.id`,
    [requestId, sellerId],
  );
  if (!res.length) throw new AppError('not_found', 404);
}

/** The seller reviewed a flagged payment (late, underpaid or overpaid) and accepts it as Paid. Ceeneet never decides this alone. */
export async function resolvePayment(ctx: Ctx, sellerId: string, txId: string) {
  const [p] = await ctx.db.query<{ invoice_id: string | null; outcome: string; confirmed: boolean; success: boolean | null; resolved: boolean }>(
    `select p.invoice_id, p.outcome, p.confirmed, p.success, p.resolved from payments p join invoices i on i.id = p.invoice_id where p.tx_id = $1 and i.seller_id = $2`,
    [txId, sellerId],
  );
  if (!p) throw new AppError('not_found', 404);
  if (!['late', 'underpaid', 'overpaid'].includes(p.outcome)) throw new AppError('not_flagged', 409);
  if (!p.confirmed || !p.success) throw new AppError('not_confirmed', 409, 'Wait until the payment is confirmed on the blockchain.');
  if (p.resolved) return;
  await ctx.db.transaction(async (tx) => {
    await tx.query(`update payments set resolved = true where tx_id = $1`, [txId]);
    await tx.query(`update invoices set status = 'paid', paid_at = now() where id = $1 and status in ('late', 'underpaid', 'overpaid')`, [p.invoice_id]);
  });
}

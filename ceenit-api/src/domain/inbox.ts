import { Ctx } from './context';

// The bell inbox: the alerts a seller was sent, newest first.

type Row = { id: string; type: string; title: string; body: string; invoice_id: string | null; created_at: Date; read_at: Date | null };

export async function listNotifications(ctx: Ctx, sellerId: string) {
  const rows = await ctx.db.query<Row>(`select id, type, title, body, invoice_id, created_at, read_at from notifications where seller_id = $1 order by created_at desc limit 50`, [sellerId]);
  const [u] = await ctx.db.query<{ n: number }>(`select count(*)::int as n from notifications where seller_id = $1 and read_at is null`, [sellerId]);
  return {
    unread: u?.n ?? 0,
    items: rows.map((r) => ({ id: r.id, type: r.type, title: r.title, body: r.body, invoiceId: r.invoice_id, at: r.created_at.toISOString(), read: !!r.read_at })),
  };
}

export async function markAllRead(ctx: Ctx, sellerId: string): Promise<void> {
  await ctx.db.query(`update notifications set read_at = now() where seller_id = $1 and read_at is null`, [sellerId]);
}

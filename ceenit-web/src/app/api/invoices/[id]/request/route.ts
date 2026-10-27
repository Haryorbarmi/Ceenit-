import { API_URL, toInvoice, type ApiInvoice } from '@/lib/api';

// The buyer taps "Request a new link". The API tells the seller, who approves it in the Ceeneet app.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { buyerName?: string };
  const res = await fetch(`${API_URL}/v1/public/invoices/${encodeURIComponent(id)}/request-new-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ buyerName: body.buyerName ?? '' }),
  }).catch(() => null);
  if (!res) return Response.json({ error: 'unavailable' }, { status: 503 });
  if (!res.ok) return Response.json(await res.json().catch(() => ({ error: 'failed' })), { status: res.status });
  return Response.json(toInvoice((await res.json()) as ApiInvoice));
}

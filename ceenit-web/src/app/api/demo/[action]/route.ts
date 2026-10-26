import { API_URL, type ApiInvoice } from '@/lib/api';

// Development only. Drives the pretend TRON network so every payment state can be seen from the page.
// It does nothing in a production build, and the API only offers these tools while running against the fake network.
const post = (path: string, body: unknown = {}) =>
  fetch(API_URL + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export async function POST(req: Request, { params }: { params: Promise<{ action: string }> }) {
  if (process.env.NODE_ENV === 'production') return Response.json({ error: 'not_found' }, { status: 404 });
  const { action } = await params;
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };

  if (action === 'new') {
    const r = await post('/dev/demo-invoice', { amount: '8000' });
    return Response.json(await r.json(), { status: r.status });
  }
  if (!id) return Response.json({ error: 'id_required' }, { status: 400 });

  if (action === 'expire') return Response.json(await (await post(`/dev/expire/${id}`)).json());
  if (action === 'approve') {
    const r = await post(`/dev/approve-request/${id}`);
    return Response.json(await r.json(), { status: r.status });
  }
  if (action === 'mine5') return Response.json(await (await post('/dev/mine', { blocks: 5 })).json());
  if (action === 'mine-final') return Response.json(await (await post('/dev/mine', { blocks: 25 })).json());

  if (action === 'pay' || action === 'pay-short' || action === 'pay-over') {
    const inv = (await (await fetch(`${API_URL}/v1/public/invoices/${id}`, { cache: 'no-store' })).json()) as ApiInvoice;
    const due = Number(inv.amount);
    const amount = action === 'pay' ? inv.amount : (due + (action === 'pay-short' ? -50.18 : 14.36)).toFixed(2);
    const r = await post('/dev/simulate-payment', { to: inv.wallet, amount });
    return Response.json(await r.json(), { status: r.status });
  }
  return Response.json({ error: 'unknown_action' }, { status: 400 });
}

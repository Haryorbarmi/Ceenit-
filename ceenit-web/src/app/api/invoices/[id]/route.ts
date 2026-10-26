import { fetchInvoice } from '@/lib/api';

// The payment page asks this every few seconds to find out whether the payment has landed.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const invoice = await fetchInvoice(id);
    if (!invoice) return Response.json({ error: 'not_found' }, { status: 404 });
    return Response.json(invoice, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'unavailable' }, { status: 503 });
  }
}

import { notFound } from 'next/navigation';
import { PayClient } from '@/components/PayClient';
import { fetchInvoice } from '@/lib/api';

export const metadata = { title: 'Pay · Ceenit' };

// ceenit.app/pay/<invoice>. The buyer opens this from the seller's WhatsApp message. No account needed.
export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await fetchInvoice(id);
  if (!invoice) notFound();
  return <PayClient key={invoice.id} initial={invoice} demo={process.env.NODE_ENV !== 'production'} />;
}

import { API_URL } from '@/lib/api';

// The browser asks this web server for the naira estimate, which asks the Ceeneet API (Aboki Forex).
export async function GET() {
  const res = await fetch(`${API_URL}/v1/rate`, { next: { revalidate: 300 } }).catch(() => null);
  if (!res?.ok) return Response.json({ error: 'unavailable' }, { status: 503 });
  return Response.json(await res.json());
}

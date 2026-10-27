import { API_URL } from '@/lib/api';

// The browser talks to this web server, which passes likes on to the Ceenit API.
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const visitor = new URL(req.url).searchParams.get('visitor') ?? '';
  const res = await fetch(`${API_URL}/v1/public/sellers/${encodeURIComponent(slug)}?visitor=${encodeURIComponent(visitor)}`, { cache: 'no-store' }).catch(() => null);
  if (!res?.ok) return Response.json({ error: 'unavailable' }, { status: res?.status ?? 503 });
  const p = await res.json();
  return Response.json({ likes: p.likes, liked: p.liked });
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = (await req.json().catch(() => ({}))) as { visitor?: string; liked?: boolean };
  const res = await fetch(`${API_URL}/v1/public/sellers/${encodeURIComponent(slug)}/like`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitor: body.visitor ?? '', liked: body.liked === true }),
  }).catch(() => null);
  if (!res) return Response.json({ error: 'unavailable' }, { status: 503 });
  return Response.json(await res.json().catch(() => ({ error: 'failed' })), { status: res.status });
}

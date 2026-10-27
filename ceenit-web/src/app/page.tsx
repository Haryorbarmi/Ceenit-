import Link from 'next/link';
import { NewDemoLink } from '@/components/NewDemoLink';

// Home page. Only a placeholder until the marketing site exists.
export default function Home() {
  const dev = process.env.NODE_ENV !== 'production';
  return (
    <main className="page" style={{ justifyContent: 'center', gap: 'var(--sp-lg)' }}>
      <h1 className="display">Ceeneet</h1>
      <p className="body-lg secondary">USDT payments, confirmed.</p>
      {dev ? <NewDemoLink /> : null}
      {dev ? <Link className="btn outline" href="/emeka-autos">Open the demo seller page</Link> : null}
    </main>
  );
}

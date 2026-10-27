'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

// Development only: makes a new payment link on the demo seller so the page can be tried.
export function NewDemoLink() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <>
      <button
        className="btn primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            const r = await fetch('/api/demo/new', { method: 'POST' });
            const j = await r.json();
            if (r.ok && j.id) router.push(`/pay/${j.id}`);
            else setError('The Ceeneet API did not answer. Is it running on port 4000?');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Creating…' : 'Create a demo payment link'}
      </button>
      {error ? <p className="body-sm" role="alert">{error}</p> : null}
    </>
  );
}

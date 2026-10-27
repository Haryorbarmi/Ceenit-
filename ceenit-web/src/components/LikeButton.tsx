'use client';

import { useEffect, useState } from 'react';
import { Icon } from './Icon';

// A heart on a subscribed seller's page. Each browser counts once; the browser keeps a random id so a buyer can un-like too.
function visitorId(): string {
  try {
    let v = localStorage.getItem('ceenit-visitor');
    if (!v) {
      v = crypto.randomUUID().replace(/-/g, '');
      localStorage.setItem('ceenit-visitor', v);
    }
    return v;
  } catch {
    return 'anon' + Math.random().toString(36).slice(2, 12);
  }
}

export function LikeButton({ slug, initialLikes }: { slug: string; initialLikes: number }) {
  const [likes, setLikes] = useState(initialLikes);
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);

  // Find out whether this browser already liked the page.
  useEffect(() => {
    fetch(`/api/sellers/${encodeURIComponent(slug)}/like?visitor=${visitorId()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && (setLikes(d.likes), setLiked(d.liked)))
      .catch(() => undefined);
  }, [slug]);

  async function toggle() {
    if (busy) return;
    const next = !liked;
    setBusy(true);
    setLiked(next);
    setLikes((n) => Math.max(0, n + (next ? 1 : -1)));
    try {
      const r = await fetch(`/api/sellers/${encodeURIComponent(slug)}/like`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visitor: visitorId(), liked: next }) });
      if (!r.ok) throw new Error();
      const d = await r.json();
      setLikes(d.likes);
      setLiked(d.liked);
    } catch {
      setLiked(!next);
      setLikes((n) => Math.max(0, n + (next ? -1 : 1)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className={`like${liked ? ' on' : ''}`} onClick={toggle} aria-pressed={liked} aria-label={liked ? 'Remove like' : 'Like this seller'}>
      <Icon name="heart" size={22} />
      <span>{likes} {likes === 1 ? 'like' : 'likes'}</span>
    </button>
  );
}

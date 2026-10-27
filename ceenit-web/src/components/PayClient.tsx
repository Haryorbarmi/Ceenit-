'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { Icon, IconName } from './Icon';
import { formatCountdown, formatDateTime, formatNaira, NGN_PER_USDT, formatUsdt, groupAddress, shortTx } from '@/lib/format';
import type { Invoice, Status } from '@/lib/types';

type Props = { initial: Invoice; demo: boolean };

function Seller({ inv }: { inv: Invoice }) {
  return (
    <div className="seller">
      <div className="avatar">{inv.seller.name[0]}</div>
      <span className="body-md">{inv.seller.name}</span>
      <Icon name="shield" size={18} />
    </div>
  );
}

function Kv({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={`kv${strong ? ' strong' : ''}`}>
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}

function Big({ icon, title, body, tone }: { icon: IconName; title: string; body: string; tone?: 'accent' | 'success' | 'error' | 'warning' }) {
  return (
    <div className="big">
      <div className={`icon${tone ? ' ' + tone : ''}`}><Icon name={icon} size={40} strokeWidth={2.25} /></div>
      <h1 className="h2">{title}</h1>
      <p className="secondary">{body}</p>
    </div>
  );
}

export function PayClient({ initial, demo }: Props) {
  const router = useRouter();
  const [inv, setInv] = useState<Invoice>(initial);
  const [now, setNow] = useState(() => Date.now());
  const [rate, setRate] = useState(NGN_PER_USDT);
  const [view, setView] = useState<'main' | 'receipt'>('main');
  const [copied, setCopied] = useState<string | null>(null);
  const [buyerName, setBuyerName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Check for the payment every few seconds. The real backend pushes the same status from the blockchain watcher.
  // Live naira estimate (Aboki Forex). Keeps the fixed fallback if it cannot be fetched.
  useEffect(() => {
    fetch('/api/rate').then((r) => (r.ok ? r.json() : null)).then((d) => d && typeof d.ngnPerUsdt === 'number' && setRate(d.ngnPerUsdt)).catch(() => undefined);
  }, []);

  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const r = await fetch(`/api/invoices/${inv.id}`, { cache: 'no-store' });
        if (r.ok) setInv(await r.json());
      } catch {
        /* offline for a moment, try again next tick */
      }
    }, 3000);
    return () => clearInterval(t);
  }, [inv.id]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // The seller approved the request: move the buyer to the fresh link.
  useEffect(() => {
    if (inv.status === 'requested' && inv.nextId) router.replace(`/pay/${inv.nextId}`);
  }, [inv.status, inv.nextId, router]);

  const status: Status = inv.status === 'waiting' && now > inv.expiresAt ? 'expired' : inv.status;
  const remaining = formatCountdown(inv.expiresAt, now);

  const copy = async (key: string, text: string) => {
    let ok = false;
    try {
      // Works on https (the live site).
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      // Phones block the clipboard API on plain http test addresses, so fall back to the older way.
      const box = document.createElement('textarea');
      box.value = text;
      box.style.position = 'fixed';
      box.style.opacity = '0';
      document.body.appendChild(box);
      box.select();
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }
      document.body.removeChild(box);
    }
    if (ok) {
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    }
  };

  const requestNew = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await fetch(`/api/invoices/${inv.id}/request`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ buyerName }) });
      if (r.ok) setInv(await r.json());
      else if (r.status === 429) setError('You have reached the limit for new link requests. Please message the seller.');
      else setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  // Development only: moves the pretend TRON network along so every state can be seen.
  const demoDo = async (action: string) => {
    const r = await fetch(`/api/demo/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: inv.id }) });
    const j = await r.json().catch(() => ({}));
    if (action === 'new' && j.id) {
      router.push(`/pay/${j.id}`);
      return;
    }
    const f = await fetch(`/api/invoices/${inv.id}`, { cache: 'no-store' });
    if (f.ok) setInv(await f.json());
    setView('main');
  };

  const whatsapp = `https://wa.me/${inv.seller.phone}?text=${encodeURIComponent(`Hello ${inv.seller.name}, about ${inv.item} (${formatUsdt(inv.amount)} USDT).`)}`;
  const tronscan = inv.txId ? `https://tronscan.org/#/transaction/${inv.txId}` : undefined;
  const dueText = `${formatUsdt(inv.amount)} USDT`;

  let body: React.ReactNode;
  let footer: React.ReactNode = null;

  if (status === 'waiting') {
    body = (
      <>
        <Seller inv={inv} />
        <h1 className="h3">{inv.item}</h1>
        <div className="card amount-row">
          <div className="stack-sm grow" style={{ gap: 4 }}>
            <span className="caption tertiary">Send exactly</span>
            <span className="h1">{dueText}</span>
            <span className="body-sm tertiary">≈ {formatNaira(inv.amount, rate)} · estimate only</span>
          </div>
          <button className="copy-circle" aria-label="Copy amount" onClick={() => copy('amount', formatUsdt(inv.amount).replace(/,/g, ''))}>
            <Icon name={copied === 'amount' ? 'check' : 'copy'} size={20} />
          </button>
        </div>
        <div className="banner">
          <Icon name="alert" size={18} />
          <span className="label">Network: {inv.network} only</span>
        </div>
        <div className="card pay-card" style={{ background: 'var(--bg-page)' }}>
          <div className="qr"><QRCodeSVG value={inv.wallet} size={112} marginSize={0} /></div>
          <div className="stack-sm grow">
            <span className="caption tertiary">Wallet address</span>
            <span className="body-sm" style={{ wordBreak: 'break-all' }}>{groupAddress(inv.wallet)}</span>
            <button className="btn secondary small" onClick={() => copy('wallet', inv.wallet)}>
              {copied === 'wallet' ? 'Copied' : 'Copy address'}
            </button>
          </div>
        </div>
        <div className="note accent">
          <Icon name="info" size={20} />
          <span>Send only USDT on TRON (TRC20), and the exact amount. Other networks or amounts cannot be matched.</span>
        </div>
      </>
    );
    footer = (
      <div className="status-bar">
        <div className="row">
          <Icon name="clock" size={20} />
          <span className="label">Waiting for payment</span>
        </div>
        <span className="muted">Expires in {remaining ?? '00:00'}</span>
      </div>
    );
  } else if (status === 'confirming') {
    const pct = Math.round((inv.confirmationsDone / inv.confirmationsTotal) * 100);
    body = (
      <>
        <Seller inv={inv} />
        <Big tone="accent" icon="refresh" title="Payment found" body="We are waiting for the TRON network to confirm it. This usually takes about a minute." />
        <div className="stack-sm">
          <div className="progress"><div style={{ width: `${pct}%` }} /></div>
          <span className="body-sm secondary">{inv.confirmationsDone} of {inv.confirmationsTotal} confirmations</span>
        </div>
        <div className="table">
          <Kv k="Amount received" v={dueText} strong />
          <Kv k="Network" v={inv.network} />
          <Kv k="Transaction ID" v="Confirming…" />
        </div>
        <div className="note accent"><Icon name="info" size={20} /><span>Keep this page open. Do not send the payment again.</span></div>
      </>
    );
  } else if (status === 'paid' && view === 'receipt') {
    body = (
      <>
        <div className="row between">
          <span className="wordmark">Ceeneet</span>
          <span className="chip paid"><Icon name="check" size={14} strokeWidth={2.5} />Paid</span>
        </div>
        <h1 className="h1">Receipt</h1>
        <div className="card xl stack">
          <Seller inv={inv} />
          <h2 className="h3">{inv.item}</h2>
          <p className="h1">{dueText}</p>
          <div>
            <Kv k="Date" v={formatDateTime(inv.paidAt ?? now)} />
            <Kv k="Network" v={inv.network} />
            <Kv k="Confirmations" v={`${inv.confirmationsDone} of ${inv.confirmationsTotal}`} />
            <Kv k="Transaction ID" v={shortTx(inv.txId ?? '')} />
          </div>
          <p className="caption tertiary">Verified on the TRON blockchain by Ceeneet. Ceeneet never holds funds.</p>
        </div>
      </>
    );
    footer = (
      <div className="footer no-print">
        <a className="btn outline" href={tronscan} target="_blank" rel="noopener noreferrer">View proof on Tronscan<Icon name="external" size={16} /></a>
        <button className="btn secondary" onClick={() => window.print()}>Save as PDF</button>
        <button className="btn text" onClick={() => setView('main')}>Back</button>
      </div>
    );
  } else if (status === 'paid') {
    body = (
      <>
        <Seller inv={inv} />
        <Big tone="success" icon="check" title="Payment received" body={`${inv.seller.name} has been paid ${dueText} for ${inv.item}.`} />
        <div className="table">
          <Kv k="Paid" v={formatDateTime(inv.paidAt ?? now)} />
          <Kv k="Network" v={inv.network} />
          <Kv k="Confirmations" v={`${inv.confirmationsDone} of ${inv.confirmationsTotal}`} />
          <Kv k="Transaction ID" v={shortTx(inv.txId ?? '')} strong />
        </div>
      </>
    );
    footer = (
      <div className="footer">
        <button className="btn primary" onClick={() => setView('receipt')}>View receipt</button>
        <p className="body-sm tertiary center">You can close this page. Your receipt stays on this link.</p>
      </div>
    );
  } else if (status === 'expired') {
    body = (
      <>
        <Seller inv={inv} />
        <Big tone="error" icon="x-circle" title="This link has expired" body={`Payment links last a short time. Request a new one from ${inv.seller.name}.`} />
        <div className="table">
          <Kv k="Item" v={inv.item} strong />
          <Kv k="Previous amount" v={dueText} />
        </div>
        <label className="field">
          <span className="label">Your name or phone (optional)</span>
          <input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="So the seller knows it is you" autoComplete="name" />
        </label>
        <div className="note warning">
          <Icon name="alert" size={20} />
          <span>Already paid? Do not pay again. Tell the seller, and they will check the payment.</span>
        </div>
        {error ? <p className="body-sm" role="alert">{error}</p> : null}
      </>
    );
    footer = (
      <div className="footer">
        <button className="btn primary" onClick={requestNew} disabled={busy}>{busy ? 'Sending…' : 'Request a new link'}</button>
      </div>
    );
  } else if (status === 'requested') {
    body = (
      <>
        <Seller inv={inv} />
        <Big tone="accent" icon="refresh" title={`Waiting for ${inv.seller.name}`} body="They have been told. This page updates by itself when your new link is ready." />
        <div className="timeline">
          <div className="step"><span className="dot on" /><span className="body-md grow">Request sent</span><span className="body-sm tertiary">{new Date(now).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })}</span></div>
          <div className="step"><span className="dot" /><span className="body-md grow tertiary">Seller approves</span><span className="body-sm tertiary">Waiting…</span></div>
          <div className="step"><span className="dot" /><span className="body-md grow tertiary">New payment link</span><span className="body-sm tertiary">Appears here</span></div>
        </div>
      </>
    );
    footer = (
      <div className="footer">
        <a className="btn outline" href={whatsapp} target="_blank" rel="noopener noreferrer"><Icon name="message" size={18} />Message the seller on WhatsApp</a>
      </div>
    );
  } else {
    // late, underpaid, overpaid: the payment arrived but does not match the invoice, so the seller decides.
    const received = inv.received ?? inv.amount;
    const copyFor: Record<'late' | 'underpaid' | 'overpaid', { title: string; text: string }> = {
      late: { title: 'We received your payment', text: 'It arrived after this link expired. The seller has been told and will confirm it. You do not need to pay again.' },
      underpaid: { title: 'We received less than the amount due', text: 'The seller has been told and will contact you. Please do not send the rest unless they ask you to.' },
      overpaid: { title: 'We received more than the amount due', text: 'The seller has been told. Any difference is arranged between you and the seller, outside Ceeneet.' },
    };
    const c = copyFor[status];
    body = (
      <>
        <Seller inv={inv} />
        <Big tone="warning" icon="alert" title={c.title} body={c.text} />
        <div className="table">
          {status !== 'late' ? <Kv k="Amount due" v={dueText} /> : null}
          <Kv k="Amount received" v={`${formatUsdt(received)} USDT`} strong />
          <Kv k="Received" v={formatDateTime(inv.receivedAt ?? now)} />
          <Kv k="Transaction ID" v={shortTx(inv.txId ?? '')} />
        </div>
      </>
    );
    footer = (
      <div className="footer">
        <a className="btn outline" href={whatsapp} target="_blank" rel="noopener noreferrer"><Icon name="message" size={18} />Message the seller on WhatsApp</a>
        <a className="btn text" href={tronscan} target="_blank" rel="noopener noreferrer">View proof on Tronscan</a>
      </div>
    );
  }

  return (
    <main className="page">
      {body}
      <div className="grow" />
      {footer}
      {demo ? (
        <details className="demo no-print">
          <summary>Demo controls (development only)</summary>
          <p className="caption tertiary" style={{ marginTop: 8 }}>A pretend TRON network. The watcher checks it every 4 seconds.</p>
          <div className="grid">
            {([
              ['pay', 'Pay exact amount'],
              ['mine5', 'Mine 5 blocks'],
              ['mine-final', 'Mine until final'],
              ['pay-short', 'Pay too little'],
              ['pay-over', 'Pay too much'],
              ['expire', 'Let link expire'],
              ['approve', 'Seller approves request'],
              ['new', 'New demo link'],
            ] as const).map(([action, label]) => (
              <button key={action} onClick={() => demoDo(action)}>{label}</button>
            ))}
          </div>
        </details>
      ) : null}
    </main>
  );
}

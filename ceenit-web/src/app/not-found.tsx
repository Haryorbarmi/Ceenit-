import { Icon } from '@/components/Icon';

export default function NotFound() {
  return (
    <main className="page">
      <div className="big">
        <div className="icon error"><Icon name="x-circle" size={40} strokeWidth={2.25} /></div>
        <h1 className="h2">We cannot find this link</h1>
        <p className="secondary">It may have been typed wrong or removed. Check the link with the seller, or ask them to send a new one.</p>
      </div>
      <div className="note warning">
        <Icon name="info" size={20} />
        <span>Never pay to an address you got from anyone but the seller. Real Ceenit links start with ceenit.app.</span>
      </div>
      <div className="grow" />
      <div className="center stack-sm">
        <span className="wordmark">ceenit</span>
        <span className="body-sm tertiary">USDT payments, confirmed.</span>
      </div>
    </main>
  );
}

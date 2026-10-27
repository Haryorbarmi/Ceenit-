import { Icon } from '@/components/Icon';

export const metadata = { title: 'Payment received · Ceenit' };

// Paystack sends the seller here after they pay for a plan. The Ceenit app takes it from there.
export default function BillingDone() {
  return (
    <main className="page" style={{ alignItems: 'stretch' }}>
      <div className="big" style={{ paddingTop: 'var(--sp-2xl)' }}>
        <div className="icon success"><Icon name="check" size={40} strokeWidth={2.25} /></div>
        <h1 className="h1">Thank you</h1>
        <p className="secondary">Your payment went through. Close this page and go back to the Ceenit app. Your plan will be active in a moment.</p>
      </div>
      <div className="grow" />
      <div className="center stack-sm">
        <span className="wordmark">ceenit</span>
        <span className="body-sm tertiary">USDT payments, confirmed.</span>
      </div>
    </main>
  );
}

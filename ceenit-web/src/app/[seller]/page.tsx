import { notFound } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { LikeButton } from '@/components/LikeButton';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { fetchSeller } from '@/lib/api';

// ceenit.app/<seller>. Shows who the seller is. It has no payment function: buyers pay through a link from the seller.
export default async function SellerPage({ params }: { params: Promise<{ seller: string }> }) {
  const { seller: slug } = await params;
  const seller = await fetchSeller(slug);
  if (!seller) notFound();

  return (
    <main className="page" style={{ alignItems: 'stretch' }}>
      <div className="big" style={{ paddingTop: 'var(--sp-xl)' }}>
        {seller.photo ? <img className="avatar lg" src={seller.photo} alt="" /> : <div className="avatar lg">{seller.name[0]}</div>}
        <h1 className="h1" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--sp-xs)' }}>
          {seller.name}
          {seller.verified ? <VerifiedBadge size={28} /> : null}
        </h1>
        <p className="secondary">{seller.category} · {seller.city}</p>
        <p className="body-sm tertiary">On Ceenit since {seller.since}</p>
        {seller.likesEnabled ? <LikeButton slug={seller.slug} initialLikes={seller.likes} /> : null}
      </div>
      <div className="note accent">
        <Icon name="info" size={20} />
        <span>To pay {seller.name}, ask them to send you a payment link. Payments go straight to their wallet and are checked on the blockchain.</span>
      </div>
      <div className="grow" />
      <div className="center stack-sm">
        <span className="wordmark">ceenit</span>
        <span className="body-sm tertiary">USDT payments, confirmed.</span>
      </div>
    </main>
  );
}

// The tick next to a subscribed seller's name: a scalloped seal with a check, like the ones on social apps.
export function VerifiedBadge({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="Verified seller" style={{ flex: 'none' }}>
      <path
        fill="var(--badge, #0866ff)"
        d="M12 1.5l2.3 1.7 2.8-.2 1.1 2.6 2.5 1.3-.5 2.8 1.3 2.5-1.7 2.3.2 2.8-2.6 1.1-1.3 2.5-2.8-.5L12 22.5l-2.3-1.7-2.8.2-1.1-2.6-2.5-1.3.5-2.8L2.5 11.8l1.7-2.3-.2-2.8 2.6-1.1 1.3-2.5 2.8.5z"
      />
      <path d="m7.8 12.2 3 3 5.4-5.8" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

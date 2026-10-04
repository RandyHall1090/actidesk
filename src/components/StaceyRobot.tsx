// Stacey's mark: a small robot face, drawn in currentColor so it takes the
// colour of whatever holds it (the round launcher, the panel header).
// Verbatim from ActiScan's StaceyRobot.tsx so every product matches.
export function StaceyRobot({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      {/* antenna */}
      <path d="M12 2.5v2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="2.2" r="1.1" fill="currentColor" />
      {/* head */}
      <rect x="4.5" y="5.5" width="15" height="12" rx="3.5" stroke="currentColor" strokeWidth="1.7" />
      {/* ears */}
      <path d="M3 10v3.5M21 10v3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      {/* eyes */}
      <circle cx="9.2" cy="10.8" r="1.5" fill="currentColor" />
      <circle cx="14.8" cy="10.8" r="1.5" fill="currentColor" />
      {/* mouth */}
      <path d="M9.5 14.4h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      {/* neck and shoulders */}
      <path d="M9 17.5v1.5M15 17.5v1.5M6.5 21.5c.6-1.6 2.6-2.5 5.5-2.5s4.9.9 5.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

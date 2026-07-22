export function CubicleMark({ className }: { className?: string }) {
  return (
    <div
      className={`relative flex items-center justify-center rounded-[22%] bg-gradient-to-b from-[#48484a] to-[#1d1d1f] shadow-[0_8px_24px_rgba(0,0,0,0.18)] ${className ?? ""}`}
    >
      <svg viewBox="0 0 40 40" fill="none" aria-hidden="true" className="size-[58%]">
        <rect x="8" y="12" width="24" height="15" rx="3" fill="rgba(255,255,255,0.92)" />
        <rect x="11" y="15" width="18" height="9" rx="1.5" fill="rgba(0,0,0,0.08)" />
        <circle cx="29" cy="14" r="2" fill="#30d158" />
      </svg>
    </div>
  );
}

export function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 12 20"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M2 2l8 8-8 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.35"
      />
    </svg>
  );
}

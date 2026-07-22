/**
 * Google Calendar product icon — compact multicolor mark for integration rows.
 */
export function GoogleCalendarLogo({
  className,
  size = 40,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <rect width="40" height="40" rx="8" fill="#fff" />
      <path
        d="M8 12.5C8 10.0147 10.0147 8 12.5 8H27.5C29.9853 8 32 10.0147 32 12.5V14H8V12.5Z"
        fill="#1A73E8"
      />
      <rect x="12.5" y="6.5" width="2" height="4" rx="1" fill="#185ABC" />
      <rect x="25.5" y="6.5" width="2" height="4" rx="1" fill="#185ABC" />
      <rect x="8" y="14" width="24" height="18" rx="0" fill="#fff" />
      <path
        d="M8 30.5C8 32.9853 10.0147 35 12.5 35H27.5C29.9853 35 32 32.9853 32 30.5V14H8V30.5Z"
        fill="#fff"
      />
      <rect
        x="8.5"
        y="8.5"
        width="23"
        height="26"
        rx="4"
        stroke="rgba(0,0,0,0.08)"
      />
      {/* Day grid */}
      <rect x="11" y="17" width="5" height="4.5" rx="0.75" fill="#EA4335" />
      <rect x="17.5" y="17" width="5" height="4.5" rx="0.75" fill="#FBBC04" />
      <rect x="24" y="17" width="5" height="4.5" rx="0.75" fill="#34A853" />
      <rect x="11" y="23" width="5" height="4.5" rx="0.75" fill="#4285F4" />
      <rect x="17.5" y="23" width="5" height="4.5" rx="0.75" fill="#1A73E8" />
      <rect x="24" y="23" width="5" height="4.5" rx="0.75" fill="#188038" />
      <rect x="11" y="29" width="5" height="3" rx="0.75" fill="#E8F0FE" />
      <rect x="17.5" y="29" width="5" height="3" rx="0.75" fill="#E8F0FE" />
      <rect x="24" y="29" width="5" height="3" rx="0.75" fill="#E8F0FE" />
    </svg>
  );
}

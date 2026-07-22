import { cn } from "@/lib/utils";

/**
 * Instagram / X style blue verification tick.
 * Only permanent school staff should receive this badge.
 */
export function VerifiedBadge({
  className,
  size = "sm",
  title = "Verified permanent staff",
}: {
  className?: string;
  size?: "xs" | "sm" | "md";
  title?: string;
}) {
  const dim = size === "xs" ? "size-3" : size === "md" ? "size-4" : "size-3.5";

  return (
    <span
      role="img"
      aria-label={title}
      title={title}
      className={cn("inline-flex shrink-0 text-[#1d9bf0]", dim, className)}
    >
      <svg
        viewBox="0 0 22 22"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="size-full"
        aria-hidden
      >
        <path
          d="M20.396 11c-.018-.27-.096-.54-.22-.79l-1.35-2.73a1.5 1.5 0 0 1-.16-.75V5.1a1.6 1.6 0 0 0-1.6-1.6h-1.63c-.26 0-.51-.055-.74-.16L11.79.9a1.6 1.6 0 0 0-1.58 0L7.48 3.34c-.23.105-.48.16-.74.16H5.1A1.6 1.6 0 0 0 3.5 5.1v1.63c0 .26-.055.51-.16.74L1.74 10.2a1.6 1.6 0 0 0 0 1.58l1.6 2.73c.105.23.16.48.16.74V17a1.6 1.6 0 0 0 1.6 1.6h1.63c.26 0 .51.055.74.16l2.73 1.6c.49.28 1.09.28 1.58 0l2.73-1.6c.23-.105.48-.16.74-.16H17a1.6 1.6 0 0 0 1.6-1.6v-1.63c0-.26.055-.51.16-.74l1.6-2.73c.124-.25.202-.52.22-.79Z"
          fill="currentColor"
        />
        <path
          d="M9.95 14.35 6.8 11.2l1.13-1.13 2.02 2.02 4.12-4.12 1.13 1.13-5.25 5.25Z"
          fill="white"
        />
      </svg>
    </span>
  );
}

/** Name + optional blue tick for permanent staff. */
export function VerifiedName({
  name,
  verified,
  className,
  nameClassName,
  size = "sm",
}: {
  name: string;
  verified?: boolean;
  className?: string;
  nameClassName?: string;
  size?: "xs" | "sm" | "md";
}) {
  return (
    <span className={cn("inline-flex min-w-0 max-w-full items-center gap-1", className)}>
      <span className={cn("truncate", nameClassName)}>{name}</span>
      {verified ? <VerifiedBadge size={size} /> : null}
    </span>
  );
}

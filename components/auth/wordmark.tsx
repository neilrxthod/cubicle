import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Brand lockup: animated bloub + uppercase Cubicle word.
 */
const sizeStyles = {
  sm: "text-[11px] tracking-[0.34em]",
  md: "text-[12px] tracking-[0.38em]",
  lg: "text-[14px] tracking-[0.42em]",
  hero: "text-[clamp(1.85rem,4.4vw,2.85rem)] tracking-[0.48em] leading-none",
} as const;

const bloubPx = {
  sm: 32,
  md: 32,
  lg: 34,
  hero: 64,
} as const;

const bloubGap = {
  sm: "gap-1.5 sm:gap-2",
  md: "gap-1.5 sm:gap-2",
  lg: "gap-2",
  hero: "gap-3 sm:gap-4",
} as const;

type WordmarkSize = keyof typeof sizeStyles;
type WordmarkTone = "dark" | "light" | "muted";

type CubicleWordmarkProps = {
  size?: WordmarkSize;
  /** Pass `null` for a non-link decorative mark */
  href?: string | null;
  tone?: WordmarkTone;
  /** Defaults on. Pass false to hide the mark. */
  bloub?: boolean;
  className?: string;
};

const toneStyles = {
  dark: "text-neutral-950",
  light: "text-white",
  muted: "text-neutral-500",
} as const;

function BloubMark({ px }: { px: number }) {
  return (
    // Animated GIF — next/image would freeze the cycle.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/icons/bloub-default-cycle.gif"
      alt=""
      width={px}
      height={px}
      draggable={false}
      className="pointer-events-none shrink-0 select-none object-contain"
      style={{ width: px, height: px }}
    />
  );
}

export function CubicleWordmark({
  size = "md",
  href = "/login",
  tone = "dark",
  bloub,
  className,
}: CubicleWordmarkProps) {
  const showBloub = bloub !== false;
  const mark = (
    <span
      className={cn(
        "inline-flex items-center",
        showBloub && bloubGap[size],
      )}
    >
      {showBloub ? <BloubMark px={bloubPx[size]} /> : null}
      <span
        className={cn(
          "inline-block select-none font-extralight uppercase antialiased",
          sizeStyles[size],
          toneStyles[tone],
          className,
        )}
      >
        Cubicle
      </span>
    </span>
  );

  if (href === null) {
    return mark;
  }

  return (
    <Link
      href={href}
      aria-label="Cubicle home"
      className="inline-flex items-center rounded-sm transition-opacity duration-200 hover:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/15 focus-visible:ring-offset-2"
    >
      {mark}
    </Link>
  );
}

import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Tesla-style wordmark: pure type, uppercase, open tracking, light weight.
 * No icon — the name is the logo.
 */
const sizeStyles = {
  sm: "text-[11px] tracking-[0.34em]",
  md: "text-[12px] tracking-[0.38em]",
  lg: "text-[14px] tracking-[0.42em]",
  hero: "text-[clamp(1.85rem,4.4vw,2.85rem)] tracking-[0.48em] leading-none",
} as const;

type WordmarkSize = keyof typeof sizeStyles;

type CubicleWordmarkProps = {
  size?: WordmarkSize;
  /** Pass `null` for a non-link decorative mark */
  href?: string | null;
  tone?: "dark" | "light" | "muted";
  className?: string;
};

const toneStyles = {
  dark: "text-neutral-950",
  light: "text-white",
  muted: "text-neutral-500",
} as const;

export function CubicleWordmark({
  size = "md",
  href = "/login",
  tone = "dark",
  className,
}: CubicleWordmarkProps) {
  const mark = (
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
  );

  if (href === null) {
    return mark;
  }

  return (
    <Link
      href={href}
      aria-label="Cubicle home"
      className="inline-flex rounded-sm transition-opacity duration-200 hover:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/15 focus-visible:ring-offset-2"
    >
      {mark}
    </Link>
  );
}

import Link from "next/link";
import { cn } from "@/lib/utils";

const sizeStyles = {
  sm: "text-[14px] tracking-[-0.038em]",
  md: "text-[16px] tracking-[-0.042em]",
  lg: "text-[21px] tracking-[-0.048em]",
  hero: "text-[clamp(2.75rem,5.2vw,4.5rem)] tracking-[-0.06em] leading-[0.9]",
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

/**
 * Cubicle wordmark — type only, no icon.
 * Tuned tracking + weight so the name reads like a real product logo.
 */
export function CubicleWordmark({
  size = "md",
  href = "/login",
  tone = "dark",
  className,
}: CubicleWordmarkProps) {
  const mark = (
    <span
      className={cn(
        "inline-block font-semibold select-none",
        sizeStyles[size],
        toneStyles[tone],
        className,
      )}
    >
      
    </span>
  );

  if (href === null) {
    return mark;
  }

  return (
    <Link
      href={href}
      aria-label="Cubicle home"
      className="inline-flex rounded-sm transition-opacity duration-200 hover:opacity-65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/15 focus-visible:ring-offset-2"
    >
      {mark}
    </Link>
  );
}

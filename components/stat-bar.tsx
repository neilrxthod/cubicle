import Link from "next/link";
import { cn } from "@/lib/utils";

type Stat = {
  label: string;
  value: number | string;
  href?: string;
};

/**
 * Home KPI strip — quiet surfaces, clear numbers, no gradient noise.
 */
export function StatBar({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-5">
      {stats.map((stat) => {
        const isIssues = stat.label === "Issues";
        const n =
          typeof stat.value === "number"
            ? stat.value
            : Number.parseInt(String(stat.value), 10);
        const hasOpenIssues = isIssues && !Number.isNaN(n) && n > 0;

        const cardClass = cn(
          "flex flex-col gap-1 rounded-xl border px-3.5 py-3.5 text-left transition sm:px-4 sm:py-4",
          isIssues && hasOpenIssues
            ? "border-red-200/90 bg-red-50/50"
            : "border-[var(--hairline-strong)] bg-white shadow-[var(--shadow-surface)]",
          stat.href &&
            (isIssues && hasOpenIssues
              ? "hover:border-red-300 hover:bg-red-50/80"
              : "hover:border-neutral-300 hover:bg-neutral-50/60"),
        );

        const body = (
          <>
            <span
              className={cn(
                "type-label",
                hasOpenIssues ? "text-red-600" : "text-neutral-400",
              )}
            >
              {stat.label}
            </span>
            <span
              className={cn(
                "type-metric",
                hasOpenIssues ? "text-red-600" : "text-neutral-950",
              )}
            >
              {stat.value}
            </span>
          </>
        );

        if (stat.href) {
          return (
            <Link key={stat.label} href={stat.href} className={cardClass}>
              {body}
            </Link>
          );
        }

        return (
          <div key={stat.label} className={cardClass}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

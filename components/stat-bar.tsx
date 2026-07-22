import { cn } from "@/lib/utils";

type Stat = {
  label: string;
  value: number | string;
};

/**
 * Day-at-a-glance metrics — single strip on desktop, tight grid on mobile.
 */
export function StatBar({ stats }: { stats: Stat[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      {/* Desktop / large: one continuous bar */}
      <div className="hidden divide-x divide-neutral-100 sm:grid sm:grid-cols-5">
        {stats.map((stat) => (
          <StatCell key={stat.label} stat={stat} />
        ))}
      </div>

      {/* Mobile: 2-column cards without outer double borders */}
      <div className="grid grid-cols-2 divide-x divide-y divide-neutral-100 sm:hidden">
        {stats.map((stat, i) => (
          <StatCell
            key={stat.label}
            stat={stat}
            className={cn(
              // Last odd item spans full width for balance when 5 stats
              stats.length % 2 === 1 && i === stats.length - 1 && "col-span-2",
            )}
          />
        ))}
      </div>
    </div>
  );
}

function StatCell({
  stat,
  className,
}: {
  stat: Stat;
  className?: string;
}) {
  const numeric =
    typeof stat.value === "number"
      ? stat.value
      : Number.parseInt(String(stat.value), 10);
  const isAlert =
    stat.label === "Issues" && !Number.isNaN(numeric) && numeric > 0;
  const isHighlight =
    stat.label === "Yours" && !Number.isNaN(numeric) && numeric > 0;

  return (
    <div
      className={cn(
        "flex flex-col justify-center px-4 py-4 sm:px-5 sm:py-5",
        className,
      )}
    >
      <span className="text-[11px] font-medium tracking-[0.04em] text-neutral-400">
        {stat.label}
      </span>
      <span
        className={cn(
          "mt-1.5 text-[1.625rem] font-semibold leading-none tracking-[-0.04em] tabular-nums sm:text-[1.75rem]",
          isAlert
            ? "text-amber-600"
            : isHighlight
              ? "text-neutral-950"
              : "text-neutral-950",
        )}
      >
        {stat.value}
      </span>
      {isAlert ? (
        <span className="mt-1.5 text-[11px] font-medium text-amber-600/80">
          Needs attention
        </span>
      ) : (
        <span className="mt-1.5 h-[15px]" aria-hidden />
      )}
    </div>
  );
}

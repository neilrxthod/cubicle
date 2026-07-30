"use client";

import { cn } from "./_adapter";
import type {
  StatsDisplayProps,
  StatItem,
  StatFormat,
  StatDiff,
} from "./schema";
import { Sparkline } from "./sparkline";

const TESLA_SPARK = "rgb(23 23 23)";

function FormattedValue({
  value,
  format,
  locale,
}: {
  value: string | number;
  format?: StatFormat;
  locale?: string;
}) {
  if (typeof value === "string" || !format) {
    return <span className="tabular-nums">{String(value)}</span>;
  }

  switch (format.kind) {
    case "number": {
      const decimals = format.decimals ?? 0;
      if (format.compact) {
        const parts = new Intl.NumberFormat(locale, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
          notation: "compact",
        }).formatToParts(value);
        const fullNumber = new Intl.NumberFormat(locale).format(value);
        return (
          <span className="tabular-nums" aria-label={fullNumber}>
            {parts.map((part, i) =>
              part.type === "compact" ? (
                <span
                  key={i}
                  className="ml-0.5 text-[0.55em] font-normal text-neutral-400"
                  aria-hidden="true"
                >
                  {part.value}
                </span>
              ) : (
                <span key={i}>{part.value}</span>
              ),
            )}
          </span>
        );
      }
      return (
        <span className="tabular-nums">
          {new Intl.NumberFormat(locale, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          }).format(value)}
        </span>
      );
    }
    case "currency": {
      const decimals = format.decimals ?? 2;
      return (
        <span className="tabular-nums">
          {new Intl.NumberFormat(locale, {
            style: "currency",
            currency: format.currency,
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          }).format(value)}
        </span>
      );
    }
    case "percent": {
      const decimals = format.decimals ?? 2;
      const basis = format.basis ?? "fraction";
      const numeric = basis === "fraction" ? value * 100 : value;
      const formatted = numeric.toFixed(decimals);
      return (
        <span className="tabular-nums" aria-label={`${formatted} percent`}>
          {formatted}
          <span
            className="ml-0.5 text-[0.42em] font-light text-neutral-400"
            aria-hidden="true"
          >
            %
          </span>
        </span>
      );
    }
    case "text":
    default:
      return <span className="tabular-nums">{String(value)}</span>;
  }
}

function DeltaValue({ diff }: { diff: StatDiff }) {
  const { value, decimals = 1, upIsPositive = true, label } = diff;
  const isPositive = value > 0;
  const isNegative = value < 0;
  const isZero = Math.abs(value) < 0.05;
  const isGood = upIsPositive ? isPositive : isNegative;
  const isBad = upIsPositive ? isNegative : isPositive;
  const formatted = Math.abs(value).toFixed(decimals);
  const display = isZero
    ? "0%"
    : `${isNegative ? "−" : "+"}${formatted}%`;

  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1 text-[11px] font-medium tabular-nums tracking-[-0.01em]",
        isZero && "text-neutral-300",
        !isZero && isGood && "text-neutral-500",
        !isZero && isBad && "text-neutral-950",
        !isZero && !isGood && !isBad && "text-neutral-400",
      )}
    >
      <span>{display}</span>
      {label ? (
        <span className="font-normal text-neutral-400">{label}</span>
      ) : null}
    </span>
  );
}

function isEmphasized(stat: StatItem) {
  return (
    stat.key === "issues" &&
    typeof stat.value === "number" &&
    stat.value > 0
  );
}

function StatCell({
  stat,
  locale,
  index = 0,
}: {
  stat: StatItem;
  locale?: string;
  index?: number;
}) {
  const sparkData = stat.sparkline?.data ?? [];
  const hasSparkline = sparkData.length >= 2;
  const emphasize = isEmphasized(stat);

  return (
    <div
      className="relative flex h-full min-h-[7.25rem] flex-col justify-between gap-3 px-4 py-4 sm:min-h-[7.75rem] sm:px-5 sm:py-5"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "text-[10px] font-medium uppercase tracking-[0.16em]",
            emphasize ? "text-neutral-950" : "text-neutral-400",
          )}
        >
          {stat.label}
        </span>
        {hasSparkline ? (
          <div
            className="h-7 w-14 shrink-0 opacity-70 sm:h-8 sm:w-16"
            title={`14-day trend (${sparkData[0]} → ${sparkData[sparkData.length - 1]})`}
          >
            <Sparkline
              data={sparkData}
              color={TESLA_SPARK}
              showFill
              fillOpacity={0.08}
              width={64}
              height={32}
              className="h-full w-full"
            />
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-x-2.5 gap-y-1">
        <span className="text-[1.875rem] font-light leading-none tracking-[-0.04em] text-neutral-950 sm:text-[2.125rem]">
          <FormattedValue
            value={stat.value}
            format={stat.format}
            locale={locale}
          />
        </span>
        {stat.diff ? <DeltaValue diff={stat.diff} /> : null}
      </div>
    </div>
  );
}

function MetricsStrip({
  stats,
  locale,
}: {
  stats: StatItem[];
  locale?: string;
}) {
  const n = stats.length;

  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-[var(--hairline-strong)] bg-white lg:flex">
        {stats.map((stat, index) => (
          <div
            key={stat.key}
            className={cn(
              "min-w-0 flex-1",
              index > 0 && "border-l border-[var(--hairline)]",
            )}
          >
            <StatCell stat={stat} locale={locale} index={index} />
          </div>
        ))}
      </div>

      <div
        className={cn(
          "overflow-hidden rounded-xl border border-[var(--hairline-strong)] bg-white lg:hidden",
          "grid grid-cols-2 sm:grid-cols-3",
        )}
      >
        {stats.map((stat, index) => {
          const colsSm = 3;
          const isLast = index === n - 1;
          const rowStartSm = Math.floor(index / colsSm) * colsSm;
          const isLastRowSm = rowStartSm + colsSm >= n;
          const isOddMobile = index % 2 === 1;
          const isLastRowMobile = index >= n - (n % 2 === 0 ? 2 : 1);

          return (
            <div
              key={stat.key}
              className={cn(
                "min-w-0 border-[var(--hairline)]",
                isOddMobile && "border-l",
                !isLastRowMobile && "border-b",
                "sm:border-l-0 sm:border-b-0",
                index % colsSm !== 0 && "sm:border-l",
                !isLastRowSm && "sm:border-b",
                isLast && n % 2 === 1 && "col-span-2 sm:col-span-1",
                isLast && n % colsSm !== 0 && n % 2 === 1 && "max-sm:border-l-0",
              )}
            >
              <StatCell stat={stat} locale={locale} index={index} />
            </div>
          );
        })}
      </div>
    </>
  );
}

export function StatsDisplay({
  id,
  title,
  description,
  stats,
  className,
  locale: localeProp,
}: StatsDisplayProps) {
  const locale =
    localeProp ??
    (typeof navigator !== "undefined" ? navigator.language : undefined);
  const hasHeader = Boolean(title || description);
  const isSingle = stats.length === 1;
  const n = stats.length;
  const horizontal = !isSingle && n >= 3;

  return (
    <article
      data-slot="stats-display"
      data-tool-ui-id={id}
      className={cn(
        "w-full min-w-0",
        !horizontal && "min-w-80 max-w-xl",
        isSingle && "max-w-sm",
        horizontal && "max-w-none",
        className,
      )}
    >
      {hasHeader ? (
        <header className="mb-3 px-0.5">
          {title ? (
            <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
              {title}
            </h2>
          ) : null}
          {description ? (
            <p className="mt-1 text-[12.5px] text-neutral-400">{description}</p>
          ) : null}
        </header>
      ) : null}

      {horizontal ? (
        <MetricsStrip stats={stats} locale={locale} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--hairline-strong)] bg-white">
          <div
            className="grid"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            }}
          >
            {stats.map((stat, index) => (
              <div
                key={stat.key}
                className={cn(
                  "min-w-0 border-[var(--hairline)]",
                  index > 0 && "border-t sm:border-l sm:border-t-0",
                )}
              >
                <StatCell stat={stat} locale={locale} index={index} />
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

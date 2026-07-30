"use client";

import { cn, Card, CardContent } from "./_adapter";
import type {
  StatsDisplayProps,
  StatItem,
  StatFormat,
  StatDiff,
} from "./schema";
import { Sparkline } from "./sparkline";

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
                  className="ml-0.5 text-[0.62em] font-normal opacity-60"
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
            className="ml-0.5 text-[0.5em] font-normal opacity-50"
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
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums tracking-tight",
        isZero && "bg-neutral-100 text-neutral-400",
        !isZero && isGood && "bg-emerald-50 text-emerald-700",
        !isZero && isBad && "bg-red-50 text-red-600",
        !isZero && !isGood && !isBad && "bg-neutral-100 text-neutral-400",
      )}
    >
      {!upIsPositive && !isZero ? (
        <span className="leading-none opacity-70" aria-hidden>
          {isGood ? "↓" : "↑"}
        </span>
      ) : null}
      {display}
      {label ? (
        <span className="font-normal text-current/65">{label}</span>
      ) : null}
    </span>
  );
}

function StatCard({
  stat,
  locale,
  isSingle = false,
  index = 0,
  asBlock = false,
}: {
  stat: StatItem;
  locale?: string;
  isSingle?: boolean;
  index?: number;
  /** Standalone tile (own border + radius) */
  asBlock?: boolean;
}) {
  const sparklineColor = stat.sparkline?.color ?? "var(--chart-3)";
  const sparkData = stat.sparkline?.data ?? [];
  const hasSparkline = sparkData.length >= 2;
  const delay = index * 55;

  return (
    <div
      className={cn(
        "relative flex h-full flex-col overflow-hidden",
        asBlock
          ? "min-h-[7.5rem] justify-between gap-2 rounded-2xl bg-white px-4 py-3.5 shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.03)] transition-[box-shadow] duration-200 hover:shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_4px_14px_rgba(0,0,0,0.05)] sm:min-h-[8rem] sm:px-5 sm:py-4"
          : cn(
              "justify-between gap-2 px-4 py-4 sm:px-5 sm:py-[1.15rem]",
              isSingle
                ? "min-h-[9rem] justify-center"
                : "min-h-[6.5rem] sm:min-h-[6.75rem]",
            ),
      )}
    >
      <div className="relative z-[1] flex items-start justify-between gap-2">
        <span
          className="pt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400"
          style={{ animationDelay: `${delay + 30}ms` }}
        >
          {stat.label}
        </span>
        {/* Dedicated spark strip — always visible, driven by real series data */}
        {hasSparkline && asBlock ? (
          <div
            className="h-9 w-[4.75rem] shrink-0 sm:h-10 sm:w-[5.5rem]"
            title={`14-day trend (${sparkData[0]} → ${sparkData[sparkData.length - 1]})`}
          >
            <Sparkline
              data={sparkData}
              color={sparklineColor}
              showFill
              fillOpacity={0.18}
              width={88}
              height={40}
              className="h-full w-full"
            />
          </div>
        ) : null}
      </div>

      {!asBlock && hasSparkline ? (
        <Sparkline
          data={sparkData}
          color={sparklineColor}
          showFill
          fillOpacity={0.1}
          className="pointer-events-none absolute inset-x-0 bottom-0 top-8 opacity-80"
        />
      ) : null}

      <div className="relative z-[1] flex flex-wrap items-end gap-x-2 gap-y-1">
        <span
          className={cn(
            "font-light tracking-[-0.035em] text-neutral-950",
            isSingle && !asBlock
              ? "text-[2.75rem] leading-none"
              : "text-[1.85rem] leading-none sm:text-[2rem]",
          )}
        >
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
            <h2 className="text-[13px] font-medium tracking-[-0.02em] text-neutral-950">
              {title}
            </h2>
          ) : null}
          {description ? (
            <p className="mt-0.5 text-[12px] text-neutral-400">{description}</p>
          ) : null}
        </header>
      ) : null}

      {horizontal ? (
        /* Each KPI is its own block — equal columns, real gaps between cards */
        <div
          className={cn(
            "grid gap-2.5 sm:gap-3",
            n === 3 && "grid-cols-1 sm:grid-cols-3",
            n === 4 && "grid-cols-2 lg:grid-cols-4",
            n >= 5 && "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
          )}
        >
          {stats.map((stat, index) => (
            <div
              key={stat.key}
              className={cn(
                "min-w-0",
                n >= 5 && index === 4 && "max-sm:col-span-2",
              )}
            >
              <StatCard
                stat={stat}
                locale={locale}
                isSingle={false}
                index={index}
                asBlock
              />
            </div>
          ))}
        </div>
      ) : (
        <Card className="gap-0 overflow-hidden rounded-2xl border-0 bg-white py-0 shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.03)]">
          <CardContent className="p-0">
            <div
              className="grid @container @[440px]:-ml-px @[440px]:-mt-px"
              style={{
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              }}
            >
              {stats.map((stat, index) => (
                <div
                  key={stat.key}
                  className={cn(
                    "overflow-clip border-border py-0",
                    index > 0 && "border-t",
                    "@[440px]:border-l @[440px]:border-t",
                  )}
                >
                  <StatCard
                    stat={stat}
                    locale={locale}
                    isSingle={isSingle}
                    index={index}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </article>
  );
}

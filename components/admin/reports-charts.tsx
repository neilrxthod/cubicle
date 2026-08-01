"use client";

import { useMemo } from "react";
import { EvilAreaChart } from "@/components/evilcharts/charts/recharts-area-chart";
import { EvilBarChart } from "@/components/evilcharts/charts/recharts-bar-chart";
import { EvilPieChart } from "@/components/evilcharts/charts/recharts-pie-chart";
import { type ChartConfig } from "@/components/evilcharts/ui/recharts-chart";
import { PERIODS, type Issue, type Period } from "@/lib/types";
import { cn } from "@/lib/utils";

const NEUTRAL = {
  light: ["#171717"],
  dark: ["#fafafa"],
};

const MUTED = {
  light: ["#737373"],
  dark: ["#a3a3a3"],
};

function ChartCard({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border border-[var(--hairline-strong)] bg-white p-4 shadow-[var(--shadow-surface)]",
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="type-section-title">{title}</h3>
        {action}
      </div>
      <div className="min-h-[14rem] flex-1">{children}</div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[14rem] items-center justify-center rounded-lg border border-dashed border-neutral-200 bg-neutral-50/50">
      <p className="text-[13px] text-neutral-400">{label}</p>
    </div>
  );
}

/** Bookings over the last 7 days. */
export function ActivityAreaChart({
  data,
}: {
  data: Array<{ date: string; day: string; count: number }>;
}) {
  const chartData = useMemo(
    () => data.map((d) => ({ day: d.day, bookings: d.count })),
    [data],
  );
  const hasData = chartData.some((d) => d.bookings > 0);

  const config = {
    bookings: {
      label: "Bookings",
      colors: {
        light: ["#171717", "#525252"],
        dark: ["#fafafa", "#a3a3a3"],
      },
    },
  } satisfies ChartConfig;

  if (!hasData) {
    return <EmptyChart label="No bookings in the last 7 days." />;
  }

  return (
    <EvilAreaChart
      data={chartData}
      config={config}
      className="h-[16rem] w-full !aspect-auto p-1"
      xDataKey="day"
      animationType="left-to-right"
    >
      <EvilAreaChart.Grid />
      <EvilAreaChart.XAxis dataKey="day" />
      <EvilAreaChart.YAxis width={28} allowDecimals={false} />
      <EvilAreaChart.Tooltip />
      <EvilAreaChart.Area dataKey="bookings" variant="gradient" strokeVariant="solid">
        <EvilAreaChart.Dot variant="border" />
        <EvilAreaChart.ActiveDot variant="colored-border" />
      </EvilAreaChart.Area>
    </EvilAreaChart>
  );
}

/** Top carts by reservation count. */
export function CartUsageBarChart({
  rows,
}: {
  rows: Array<{ cartName: string; total: number }>;
}) {
  const chartData = useMemo(
    () =>
      rows.slice(0, 6).map((r) => ({
        cart: r.cartName.length > 12 ? `${r.cartName.slice(0, 11)}…` : r.cartName,
        fullName: r.cartName,
        bookings: r.total,
      })),
    [rows],
  );

  const config = {
    bookings: {
      label: "Bookings",
      colors: NEUTRAL,
    },
  } satisfies ChartConfig;

  if (chartData.length === 0) {
    return <EmptyChart label="No cart activity yet." />;
  }

  return (
    <EvilBarChart
      data={chartData}
      config={config}
      className="h-[16rem] w-full !aspect-auto p-1"
      xDataKey="cart"
      barCategoryGap={12}
      animationType="left-to-right"
    >
      <EvilBarChart.Grid />
      <EvilBarChart.XAxis
        dataKey="cart"
        tickFormatter={(v: string) => String(v)}
      />
      <EvilBarChart.YAxis width={28} allowDecimals={false} />
      <EvilBarChart.Tooltip />
      <EvilBarChart.Bar dataKey="bookings" variant="gradient" radius={4} />
    </EvilBarChart>
  );
}

/** Top teachers by booking count (horizontal). */
export function TeacherUsageBarChart({
  rows,
}: {
  rows: Array<{ teacherName: string; total: number }>;
}) {
  const chartData = useMemo(
    () =>
      rows
        .filter((r) => r.total > 0)
        .slice(0, 6)
        .map((r) => ({
          teacher:
            r.teacherName.length > 14
              ? `${r.teacherName.slice(0, 13)}…`
              : r.teacherName,
          bookings: r.total,
        })),
    [rows],
  );

  const config = {
    bookings: {
      label: "Bookings",
      colors: MUTED,
    },
  } satisfies ChartConfig;

  if (chartData.length === 0) {
    return <EmptyChart label="No teacher bookings yet." />;
  }

  return (
    <EvilBarChart
      data={chartData}
      config={config}
      className="h-[16rem] w-full !aspect-auto p-1"
      layout="horizontal"
      xDataKey="teacher"
      barCategoryGap={10}
      animationType="left-to-right"
    >
      <EvilBarChart.Grid />
      <EvilBarChart.YAxis dataKey="teacher" width={88} />
      <EvilBarChart.XAxis allowDecimals={false} />
      <EvilBarChart.Tooltip />
      <EvilBarChart.Bar dataKey="bookings" variant="default" radius={4} />
    </EvilBarChart>
  );
}

/** Reservations by period P1–P5. */
export function PeriodBarChart({
  periodRows,
}: {
  periodRows: Array<[string, number]>;
}) {
  const map = useMemo(
    () => new Map(periodRows.map(([p, c]) => [p, c])),
    [periodRows],
  );

  const chartData = useMemo(
    () =>
      PERIODS.map((period: Period) => ({
        period,
        bookings: map.get(period) ?? 0,
      })),
    [map],
  );

  const config = {
    bookings: {
      label: "Bookings",
      colors: {
        light: ["#262626", "#737373"],
        dark: ["#e5e5e5", "#a3a3a3"],
      },
    },
  } satisfies ChartConfig;

  if (!chartData.some((d) => d.bookings > 0)) {
    return <EmptyChart label="No period data yet." />;
  }

  return (
    <EvilBarChart
      data={chartData}
      config={config}
      className="h-[16rem] w-full !aspect-auto p-1"
      xDataKey="period"
      barCategoryGap={16}
      animationType="left-to-right"
    >
      <EvilBarChart.Grid />
      <EvilBarChart.XAxis dataKey="period" />
      <EvilBarChart.YAxis width={28} allowDecimals={false} />
      <EvilBarChart.Tooltip />
      <EvilBarChart.Bar dataKey="bookings" variant="hatched" radius={4} />
    </EvilBarChart>
  );
}

/** Issue severity mix as a donut. */
export function IssueSeverityPieChart({
  counts,
}: {
  counts: Record<Issue["severity"], number>;
}) {
  const chartData = useMemo(() => {
    const rows = (
      [
        { severity: "high", count: counts.high },
        { severity: "medium", count: counts.medium },
        { severity: "low", count: counts.low },
      ] as const
    ).filter((r) => r.count > 0);
    return rows.map((r) => ({ severity: r.severity, count: r.count }));
  }, [counts]);

  const config = {
    high: {
      label: "High",
      colors: { light: ["#dc2626"], dark: ["#f87171"] },
    },
    medium: {
      label: "Medium",
      colors: { light: ["#d97706"], dark: ["#fbbf24"] },
    },
    low: {
      label: "Low",
      colors: { light: ["#525252"], dark: ["#a3a3a3"] },
    },
  } satisfies ChartConfig;

  if (chartData.length === 0) {
    return <EmptyChart label="No issues reported." />;
  }

  return (
    <EvilPieChart
      data={chartData}
      dataKey="count"
      nameKey="severity"
      config={config}
      className="h-[16rem] w-full !aspect-auto p-1"
    >
      <EvilPieChart.Legend />
      <EvilPieChart.Tooltip />
      <EvilPieChart.Pie
        innerRadius={52}
        paddingAngle={3}
        cornerRadius={6}
      />
    </EvilPieChart>
  );
}

export { ChartCard };

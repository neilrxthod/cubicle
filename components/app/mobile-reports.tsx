"use client";

import { useMemo, useState } from "react";
import { format, parseISO, subDays } from "date-fns";
import { TeacherMobileNav } from "@/components/app/teacher-mobile-nav";
import { getSchoolDate } from "@/lib/calendar/period-schedule";
import { usePlatformStore } from "@/lib/data/platform-store";
import { PERIODS, type Issue } from "@/lib/types";
import { cn } from "@/lib/utils";

type Segment = "overview" | "usage" | "issues";

type RankRow = {
  key: string;
  label: string;
  detail?: string;
  value: number;
};

function lastSevenDays(today: string): string[] {
  const end = parseISO(today);
  return Array.from({ length: 7 }, (_, index) =>
    format(subDays(end, 6 - index), "yyyy-MM-dd"),
  );
}

function share(part: number, whole: number) {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

export function MobileReports({ onBack }: { onBack: () => void }) {
  const { bookings, issues, carts, users } = usePlatformStore();
  const [segment, setSegment] = useState<Segment>("overview");
  const today = getSchoolDate();

  const stats = useMemo(() => {
    const days = lastSevenDays(today);
    const teachers = users.filter((user) => user.role === "teacher");
    const cartName = new Map(carts.map((cart) => [cart.id, cart.name]));
    const byTeacher = new Map<string, { name: string; total: number }>();
    const byCart = new Map<string, { name: string; total: number }>();
    const byPeriod = new Map<string, number>();
    const bySubject = new Map<string, number>();
    const byDay = new Map<string, number>();
    const severity = { low: 0, medium: 0, high: 0 };

    for (const day of days) byDay.set(day, 0);

    for (const booking of bookings) {
      const teacher = byTeacher.get(booking.teacherId) ?? {
        name: booking.teacherName,
        total: 0,
      };
      teacher.total += 1;
      byTeacher.set(booking.teacherId, teacher);

      const cart = byCart.get(booking.cartId) ?? {
        name: cartName.get(booking.cartId) ?? "Cart",
        total: 0,
      };
      cart.total += 1;
      byCart.set(booking.cartId, cart);

      byPeriod.set(booking.period, (byPeriod.get(booking.period) ?? 0) + 1);
      const subject = booking.subject?.trim() || "Unspecified";
      bySubject.set(subject, (bySubject.get(subject) ?? 0) + 1);
      if (byDay.has(booking.date)) {
        byDay.set(booking.date, (byDay.get(booking.date) ?? 0) + 1);
      }
    }

    for (const teacher of teachers) {
      if (!byTeacher.has(teacher.id)) {
        byTeacher.set(teacher.id, { name: teacher.name, total: 0 });
      }
    }

    for (const issue of issues) {
      severity[issue.severity] += 1;
    }

    const rank = (rows: Array<{ name: string; total: number }>): RankRow[] =>
      [...rows]
        .filter((row) => row.total > 0)
        .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
        .map((row) => ({
          key: row.name,
          label: row.name,
          value: row.total,
        }));

    const activity = days.map((date) => ({
      date,
      day: format(parseISO(date), "EEEEE"),
      count: byDay.get(date) ?? 0,
    }));

    const openIssues = issues.filter((issue) => issue.status === "open");
    const recentIssues = [...issues]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 8);

    return {
      totalBookings: bookings.length,
      activeTeachers: [...byTeacher.values()].filter((row) => row.total > 0)
        .length,
      teacherCount: teachers.length,
      openIssues: openIssues.length,
      pausedCarts: carts.filter((cart) => cart.status === "maintenance").length,
      activeCarts: carts.filter((cart) => cart.status === "active").length,
      activity,
      teachers: rank([...byTeacher.values()]),
      carts: rank([...byCart.values()]),
      periods: PERIODS.map((period) => ({
        key: period,
        label: period,
        value: byPeriod.get(period) ?? 0,
      })),
      subjects: [...bySubject.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 8)
        .map(([label, value]) => ({ key: label, label, value })),
      severity,
      recentIssues,
      cartName,
    };
  }, [bookings, issues, carts, users, today]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[#f2f2f7] pt-[env(safe-area-inset-top,0px)]">
      <TeacherMobileNav title="Reports" onBack={onBack} />

      <div className="shrink-0 px-5 pb-2 pt-1">
        <div
          role="tablist"
          aria-label="Report view"
          className="grid grid-cols-3 rounded-[9px] bg-black/[0.06] p-0.5"
        >
          {(
            [
              { id: "overview", label: "Overview" },
              { id: "usage", label: "Usage" },
              { id: "issues", label: "Issues" },
            ] as const
          ).map((item) => {
            const active = segment === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSegment(item.id)}
                className={cn(
                  "h-[30px] rounded-[7px] text-[13px] font-medium tracking-[-0.01em]",
                  active
                    ? "bg-white text-neutral-950 shadow-[0_1px_1px_rgba(0,0,0,0.08)]"
                    : "text-neutral-500",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <main className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-3">
        {segment === "overview" ? (
          <Overview stats={stats} />
        ) : segment === "usage" ? (
          <Usage stats={stats} />
        ) : (
          <IssuesPane
            severity={stats.severity}
            recentIssues={stats.recentIssues}
            cartName={stats.cartName}
          />
        )}
      </main>
    </div>
  );
}

function Overview({
  stats,
}: {
  stats: {
    totalBookings: number;
    activeTeachers: number;
    teacherCount: number;
    openIssues: number;
    pausedCarts: number;
    activeCarts: number;
    activity: Array<{ date: string; day: string; count: number }>;
  };
}) {
  const maxDay = Math.max(1, ...stats.activity.map((day) => day.count));

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="px-1 pb-2 text-[13px] font-semibold tracking-[-0.01em] text-neutral-500">
          This school
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Reservations" value={stats.totalBookings} />
          <StatTile
            label="Teachers"
            value={stats.activeTeachers}
            hint={
              stats.teacherCount
                ? `of ${stats.teacherCount}`
                : undefined
            }
          />
          <StatTile
            label="Open issues"
            value={stats.openIssues}
            accent={stats.openIssues > 0 ? "red" : undefined}
          />
          <StatTile
            label="Paused carts"
            value={stats.pausedCarts}
            hint={`${stats.activeCarts} active`}
            accent={stats.pausedCarts > 0 ? "orange" : undefined}
          />
        </div>
      </section>

      <section>
        <h2 className="px-1 pb-2 text-[13px] font-semibold tracking-[-0.01em] text-neutral-500">
          Last 7 days
        </h2>
        <div className="rounded-[12px] bg-white px-4 pb-3 pt-4">
          <div className="flex h-28 items-end justify-between gap-2">
            {stats.activity.map((day) => (
              <div
                key={day.date}
                className="flex min-w-0 flex-1 flex-col items-center gap-2"
              >
                <div className="flex h-20 w-full items-end justify-center">
                  <span
                    className="w-5 rounded-full bg-[#007aff]"
                    style={{
                      height: `${Math.max(
                        day.count > 0 ? 12 : 4,
                        (day.count / maxDay) * 80,
                      )}px`,
                      opacity: day.count > 0 ? 1 : 0.18,
                    }}
                  />
                </div>
                <span className="text-[11px] font-medium text-neutral-400">
                  {day.day}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function Usage({
  stats,
}: {
  stats: {
    totalBookings: number;
    teachers: RankRow[];
    carts: RankRow[];
    periods: RankRow[];
    subjects: RankRow[];
  };
}) {
  return (
    <div className="flex flex-col gap-6">
      <RankGroup
        title="Teachers"
        empty="No teacher usage yet"
        rows={stats.teachers}
        total={stats.totalBookings}
      />
      <RankGroup
        title="Carts"
        empty="No cart usage yet"
        rows={stats.carts}
        total={stats.totalBookings}
      />
      <RankGroup
        title="Periods"
        empty="No period data yet"
        rows={stats.periods.filter((row) => row.value > 0)}
        total={stats.totalBookings}
      />
      <RankGroup
        title="Subjects"
        empty="No subjects yet"
        rows={stats.subjects}
        total={stats.totalBookings}
      />
    </div>
  );
}

function IssuesPane({
  severity,
  recentIssues,
  cartName,
}: {
  severity: { low: number; medium: number; high: number };
  recentIssues: Issue[];
  cartName: Map<string, string>;
}) {
  const total = severity.low + severity.medium + severity.high;
  const rows: RankRow[] = [
    { key: "high", label: "High", value: severity.high },
    { key: "medium", label: "Medium", value: severity.medium },
    { key: "low", label: "Low", value: severity.low },
  ].filter((row) => row.value > 0);

  return (
    <div className="flex flex-col gap-6">
      <RankGroup
        title="Severity"
        empty="No issues reported"
        rows={rows}
        total={total}
      />
      <section>
        <h2 className="px-1 pb-2 text-[13px] font-semibold tracking-[-0.01em] text-neutral-500">
          Recent
        </h2>
        {recentIssues.length === 0 ? (
          <p className="rounded-[12px] bg-white px-4 py-8 text-center text-[15px] text-neutral-400">
            No issues yet
          </p>
        ) : (
          <ul className="overflow-hidden rounded-[12px] bg-white">
            {recentIssues.map((issue, index) => (
              <li
                key={issue.id}
                className={cn(
                  "px-4 py-3",
                  index > 0 && "border-t border-neutral-100",
                )}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-[17px] tracking-[-0.02em] text-neutral-950">
                    {cartName.get(issue.cartId) ?? "Cart"}
                  </p>
                  <span
                    className={cn(
                      "shrink-0 text-[13px] font-medium",
                      issue.status === "open"
                        ? "text-red-600"
                        : "text-neutral-400",
                    )}
                  >
                    {issue.status === "open" ? "Open" : "Resolved"}
                  </span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-neutral-500">
                  {issue.description}
                </p>
                <p className="mt-1 text-[13px] text-neutral-400">
                  {severityLabel(issue.severity)}
                  <span className="text-neutral-200"> · </span>
                  {issue.reporterName}
                  <span className="text-neutral-200"> · </span>
                  {format(parseISO(issue.createdAt), "MMM d")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: number;
  hint?: string;
  accent?: "red" | "orange";
}) {
  return (
    <div className="rounded-[12px] bg-white px-4 py-3.5">
      <p className="text-[13px] font-medium text-neutral-400">{label}</p>
      <p
        className={cn(
          "mt-1 text-[34px] font-semibold leading-none tracking-[-0.04em]",
          accent === "red" && "text-red-600",
          accent === "orange" && "text-orange-500",
          !accent && "text-neutral-950",
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-1.5 text-[12px] text-neutral-400">{hint}</p>
      ) : null}
    </div>
  );
}

function RankGroup({
  title,
  empty,
  rows,
  total,
}: {
  title: string;
  empty: string;
  rows: RankRow[];
  total: number;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <section>
      <h2 className="px-1 pb-2 text-[13px] font-semibold tracking-[-0.01em] text-neutral-500">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="rounded-[12px] bg-white px-4 py-8 text-center text-[15px] text-neutral-400">
          {empty}
        </p>
      ) : (
        <ul className="overflow-hidden rounded-[12px] bg-white">
          {rows.map((row, index) => (
            <li
              key={row.key}
              className={cn("px-4 py-3", index > 0 && "border-t border-neutral-100")}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-[17px] tracking-[-0.02em] text-neutral-950">
                  {row.label}
                </p>
                <p className="shrink-0 tabular-nums text-[17px] text-neutral-400">
                  {row.value}
                  {total > 0 ? (
                    <span className="ml-1 text-[13px]">
                      {share(row.value, total)}%
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full bg-[#007aff]"
                  style={{ width: `${Math.max(6, (row.value / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function severityLabel(severity: Issue["severity"]) {
  if (severity === "high") return "High";
  if (severity === "medium") return "Medium";
  return "Low";
}


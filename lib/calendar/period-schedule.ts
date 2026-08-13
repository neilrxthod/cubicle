import type { Period } from "@/lib/types";

/**
 * Bell schedule used for Google Calendar event times.
 * Times are local to SCHOOL_TIMEZONE (Regina Public / RBE — no DST).
 * Adjust here if the school bell times change.
 */
export const SCHOOL_TIMEZONE = "America/Regina";

export type PeriodSchedule = {
  label: string;
  /** 24h HH:mm */
  start: string;
  /** 24h HH:mm */
  end: string;
};

export const PERIOD_SCHEDULE: Record<Period, PeriodSchedule> = {
  P1: { label: "Period 1", start: "08:30", end: "09:20" },
  P2: { label: "Period 2", start: "09:25", end: "10:15" },
  P3: { label: "Period 3", start: "10:20", end: "11:10" },
  P4: { label: "Period 4", start: "11:15", end: "12:05" },
  P5: { label: "Period 5", start: "12:50", end: "13:40" },
};

export function getPeriodSchedule(period: Period): PeriodSchedule {
  return PERIOD_SCHEDULE[period] ?? PERIOD_SCHEDULE.P1;
}

/** Format period for human-readable labels. */
export function formatPeriodRange(period: Period): string {
  const s = getPeriodSchedule(period);
  return `${s.label} · ${s.start}–${s.end}`;
}

function parseHm(hm: string): number {
  const [hour, minute] = hm.split(":").map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

/** Minutes since midnight in the school timezone. */
export function getSchoolMinutes(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SCHOOL_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? 0,
  );
  return hour * 60 + minute;
}

/** Calendar date in the school timezone (`yyyy-MM-dd`). */
export function getSchoolDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SCHOOL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function getCurrentPeriod(now = new Date()): Period | null {
  const mins = getSchoolMinutes(now);
  for (const period of Object.keys(PERIOD_SCHEDULE) as Period[]) {
    const sched = PERIOD_SCHEDULE[period];
    const start = parseHm(sched.start);
    const end = parseHm(sched.end);
    if (mins >= start && mins < end) return period;
  }
  return null;
}

export function getNextPeriod(now = new Date()): Period | null {
  const mins = getSchoolMinutes(now);
  for (const period of Object.keys(PERIOD_SCHEDULE) as Period[]) {
    if (mins < parseHm(PERIOD_SCHEDULE[period].start)) return period;
  }
  return null;
}

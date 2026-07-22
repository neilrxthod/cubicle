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

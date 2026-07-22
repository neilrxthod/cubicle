import type { Period, PeriodId } from "./types";

export const PERIODS: Period[] = [
  { id: 1, label: "Period 1", start: "8:00", end: "8:50" },
  { id: 2, label: "Period 2", start: "8:55", end: "9:45" },
  { id: 3, label: "Period 3", start: "9:50", end: "10:40" },
  { id: 4, label: "Period 4", start: "10:45", end: "11:35" },
  { id: 5, label: "Period 5", start: "12:15", end: "1:05" },
  { id: 6, label: "Period 6", start: "1:10", end: "2:00" },
  { id: 7, label: "Period 7", start: "2:05", end: "2:55" },
  { id: 8, label: "Period 8", start: "3:00", end: "3:50" },
];

export function getPeriod(id: PeriodId): Period {
  return PERIODS.find((period) => period.id === id) ?? PERIODS[0];
}

export function formatPeriod(id: PeriodId): string {
  const period = getPeriod(id);
  return `${period.label} · ${period.start}–${period.end}`;
}

/** Local date as YYYY-MM-DD */
export function toDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDisplayDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

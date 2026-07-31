/**
 * Saskatchewan public / statutory holidays for Regina, SK (America/Regina).
 * Used to block school laptop-cart booking days on the daily board calendar.
 *
 * Sources: Government of Saskatchewan statutory holidays + common observed-day practice
 * when a fixed-date holiday falls on a weekend.
 */

export type SkHoliday = {
  /** Local calendar date yyyy-MM-dd */
  date: string;
  name: string;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function ymd(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function fromYmd(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

function toYmd(date: Date): string {
  return ymd(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/** nth weekday in month (1 = first). weekday: 0=Sun … 6=Sat */
function nthWeekday(
  year: number,
  month: number,
  weekday: number,
  n: number,
): Date {
  const first = new Date(year, month - 1, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  const day = 1 + offset + (n - 1) * 7;
  return new Date(year, month - 1, day);
}

/** Monday on or before May 24 (Victoria Day). */
function victoriaDay(year: number): Date {
  const may24 = new Date(year, 4, 24);
  const dow = may24.getDay();
  // Monday before May 25 → if May 24 is Monday use it, else step back to Monday
  const delta = dow === 1 ? 0 : dow === 0 ? 6 : dow - 1;
  return new Date(year, 4, 24 - delta);
}

/** Anonymous Gregorian algorithm → Easter Sunday */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function goodFriday(year: number): Date {
  const easter = easterSunday(year);
  const d = new Date(easter);
  d.setDate(d.getDate() - 2);
  return d;
}

/**
 * When a fixed holiday falls on Sat/Sun, many SK workplaces also observe Monday.
 * We block the named day and the common observed weekday substitute.
 */
function withObserved(
  year: number,
  month: number,
  day: number,
  name: string,
): SkHoliday[] {
  const primary = new Date(year, month - 1, day);
  const out: SkHoliday[] = [{ date: toYmd(primary), name }];
  const dow = primary.getDay();
  if (dow === 0) {
    // Sunday → Monday observed
    const mon = new Date(year, month - 1, day + 1);
    out.push({
      date: toYmd(mon),
      name: `${name} (observed)`,
    });
  } else if (dow === 6) {
    // Saturday → Monday observed (common practice)
    const mon = new Date(year, month - 1, day + 2);
    out.push({
      date: toYmd(mon),
      name: `${name} (observed)`,
    });
  }
  return out;
}

/** Statutory / public holidays for one calendar year in Saskatchewan. */
export function getSkHolidaysForYear(year: number): SkHoliday[] {
  const list: SkHoliday[] = [
    ...withObserved(year, 1, 1, "New Year's Day"),
    {
      date: toYmd(nthWeekday(year, 2, 1, 3)),
      name: "Family Day",
    },
    {
      date: toYmd(goodFriday(year)),
      name: "Good Friday",
    },
    {
      date: toYmd(victoriaDay(year)),
      name: "Victoria Day",
    },
    ...withObserved(year, 7, 1, "Canada Day"),
    {
      date: toYmd(nthWeekday(year, 8, 1, 1)),
      name: "Saskatchewan Day",
    },
    {
      date: toYmd(nthWeekday(year, 9, 1, 1)),
      name: "Labour Day",
    },
    {
      date: toYmd(nthWeekday(year, 10, 1, 2)),
      name: "Thanksgiving",
    },
    ...withObserved(year, 11, 11, "Remembrance Day"),
    ...withObserved(year, 12, 25, "Christmas Day"),
    ...withObserved(year, 12, 26, "Boxing Day"),
  ];

  // De-dupe by date (keep first name)
  const map = new Map<string, SkHoliday>();
  for (const h of list) {
    if (!map.has(h.date)) map.set(h.date, h);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

const holidayCache = new Map<number, SkHoliday[]>();

function holidaysForYear(year: number): SkHoliday[] {
  let cached = holidayCache.get(year);
  if (!cached) {
    cached = getSkHolidaysForYear(year);
    holidayCache.set(year, cached);
  }
  return cached;
}

export function getSkHoliday(date: Date | string): SkHoliday | undefined {
  const key =
    typeof date === "string"
      ? date.slice(0, 10)
      : toYmd(date);
  const year = Number(key.slice(0, 4));
  if (!Number.isFinite(year)) return undefined;
  return holidaysForYear(year).find((h) => h.date === key);
}

export function isSkHoliday(date: Date | string): boolean {
  return Boolean(getSkHoliday(date));
}

/** Holiday Date objects for react-day-picker modifiers (year ± buffer). */
export function getSkHolidayDatesAround(
  center: Date = new Date(),
  yearRadius = 2,
): Date[] {
  const y = center.getFullYear();
  const dates: Date[] = [];
  for (let year = y - yearRadius; year <= y + yearRadius; year++) {
    for (const h of holidaysForYear(year)) {
      dates.push(fromYmd(h.date));
    }
  }
  return dates;
}

/**
 * Step from `startYmd` by `dir` days until a non-holiday (and optional predicate).
 * Caps at 21 steps to avoid infinite loops.
 */
export function skipSkHolidays(
  startYmd: string,
  dir: 1 | -1,
  isBlocked?: (ymd: string) => boolean,
): string {
  let d = fromYmd(startYmd);
  for (let i = 0; i < 21; i++) {
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + dir);
    const key = toYmd(d);
    if (isSkHoliday(key)) continue;
    if (isBlocked?.(key)) continue;
    return key;
  }
  return startYmd;
}

import type { Booking, Cart, Period } from "@/lib/types";
import {
  getPeriodSchedule,
  SCHOOL_TIMEZONE,
} from "@/lib/calendar/period-schedule";
import {
  getGoogleCalendarEventId,
  getGoogleCalendarPrefs,
  removeGoogleCalendarEventId,
  setGoogleCalendarEventId,
} from "@/lib/calendar/preferences";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const EVENTS_URL =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export type CalendarEventInput = {
  booking: Booking;
  cart?: Cart | null;
};

export type CalendarSyncResult =
  | { ok: true; eventId?: string; skipped?: boolean }
  | { ok: false; error: string; needsReconnect?: boolean };

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Build local wall-clock parts for a school date + period. */
function localDateTimeParts(date: string, period: Period) {
  const schedule = getPeriodSchedule(period);
  const [y, m, d] = date.split("-").map(Number);
  const [sh, sm] = schedule.start.split(":").map(Number);
  const [eh, em] = schedule.end.split(":").map(Number);
  return {
    start: { y, m, d, h: sh, min: sm },
    end: { y, m, d, h: eh, min: em },
  };
}

/** RFC3339 local datetime without Z — used with timeZone field. */
function toLocalDateTimeString(parts: {
  y: number;
  m: number;
  d: number;
  h: number;
  min: number;
}) {
  return `${parts.y}-${pad2(parts.m)}-${pad2(parts.d)}T${pad2(parts.h)}:${pad2(parts.min)}:00`;
}

/** Compact form for Google Calendar template links (local time). */
function toCompactLocal(parts: {
  y: number;
  m: number;
  d: number;
  h: number;
  min: number;
}) {
  return `${parts.y}${pad2(parts.m)}${pad2(parts.d)}T${pad2(parts.h)}${pad2(parts.min)}00`;
}

export function buildEventTitle(input: CalendarEventInput): string {
  const cartName = input.cart?.name?.trim() || "Laptop cart";
  const className = input.booking.className?.trim();
  return className ? `${cartName} · ${className}` : `Cubicle · ${cartName}`;
}

export function buildEventDescription(input: CalendarEventInput): string {
  const lines = [
    "Laptop cart booking via Cubicle",
    `Period: ${input.booking.period}`,
    input.booking.subject?.trim()
      ? `Subject: ${input.booking.subject.trim()}`
      : null,
    input.booking.notes?.trim() ? `Notes: ${input.booking.notes.trim()}` : null,
    input.cart?.location?.trim()
      ? `Cart home: ${input.cart.location.trim()}`
      : null,
    "",
    "Open Cubicle: https://mycubicle.app",
  ];
  return lines.filter((line) => line !== null).join("\n");
}

export function buildEventLocation(input: CalendarEventInput): string {
  return input.cart?.location?.trim() || input.cart?.name || "School";
}

/** One-click “Add to Google Calendar” (no OAuth / API). Always works. */
export function buildGoogleCalendarTemplateUrl(
  input: CalendarEventInput,
): string {
  const { start, end } = localDateTimeParts(
    input.booking.date,
    input.booking.period,
  );
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: buildEventTitle(input),
    dates: `${toCompactLocal(start)}/${toCompactLocal(end)}`,
    details: buildEventDescription(input),
    location: buildEventLocation(input),
    ctz: SCHOOL_TIMEZONE,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function eventBody(input: CalendarEventInput) {
  const { start, end } = localDateTimeParts(
    input.booking.date,
    input.booking.period,
  );
  return {
    summary: buildEventTitle(input),
    description: buildEventDescription(input),
    location: buildEventLocation(input),
    start: {
      dateTime: toLocalDateTimeString(start),
      timeZone: SCHOOL_TIMEZONE,
    },
    end: {
      dateTime: toLocalDateTimeString(end),
      timeZone: SCHOOL_TIMEZONE,
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 15 },
        { method: "popup", minutes: 60 },
      ],
    },
    source: {
      title: "Cubicle",
      url: "https://mycubicle.app",
    },
    extendedProperties: {
      private: {
        cubicleBookingId: input.booking.id,
      },
    },
  };
}

async function getGoogleAccessToken(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.provider_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Whether the current Supabase session still has a usable Google access token.
 * (Does not prove calendar scope — that is verified on first API call.)
 */
export async function hasGoogleProviderToken(): Promise<boolean> {
  const token = await getGoogleAccessToken();
  return Boolean(token);
}

export async function createGoogleCalendarEvent(
  input: CalendarEventInput,
  accessToken?: string | null,
): Promise<CalendarSyncResult> {
  const token = accessToken ?? (await getGoogleAccessToken());
  if (!token) {
    return {
      ok: false,
      error: "Google Calendar is not connected. Reconnect in Settings.",
      needsReconnect: true,
    };
  }

  try {
    const res = await fetch(EVENTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventBody(input)),
    });

    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        error:
          res.status === 403
            ? "Calendar permission missing. Reconnect Google Calendar in Settings."
            : "Google session expired. Reconnect Google Calendar in Settings.",
        needsReconnect: true,
      };
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        error: text.slice(0, 160) || `Google Calendar error (${res.status})`,
      };
    }

    const data = (await res.json()) as { id?: string };
    if (data.id) {
      setGoogleCalendarEventId(input.booking.id, data.id);
    }
    return { ok: true, eventId: data.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not create calendar event.",
    };
  }
}

export async function deleteGoogleCalendarEvent(
  bookingId: string,
  accessToken?: string | null,
): Promise<CalendarSyncResult> {
  const eventId = getGoogleCalendarEventId(bookingId);
  if (!eventId) return { ok: true, skipped: true };

  const token = accessToken ?? (await getGoogleAccessToken());
  if (!token) {
    removeGoogleCalendarEventId(bookingId);
    return {
      ok: false,
      error: "Google session expired; local calendar link cleared.",
      needsReconnect: true,
    };
  }

  try {
    const res = await fetch(
      `${EVENTS_URL}/${encodeURIComponent(eventId)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    // 404/410 = already gone — treat as success
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        error: "Google session expired. Reconnect in Settings.",
        needsReconnect: true,
      };
    }

    if (!res.ok && res.status !== 404 && res.status !== 410) {
      return {
        ok: false,
        error: `Could not remove calendar event (${res.status})`,
      };
    }

    removeGoogleCalendarEventId(bookingId);
    return { ok: true, eventId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not delete calendar event.",
    };
  }
}

/**
 * Create event if auto-sync is on and connected.
 * Soft-fails — booking itself already succeeded.
 */
export async function syncBookingCreated(
  input: CalendarEventInput,
): Promise<CalendarSyncResult> {
  const prefs = getGoogleCalendarPrefs();
  if (!prefs.connected || !prefs.autoSync) {
    return { ok: true, skipped: true };
  }
  return createGoogleCalendarEvent(input);
}

/**
 * Delete linked event if auto-sync is on and connected.
 */
export async function syncBookingCanceled(
  bookingId: string,
): Promise<CalendarSyncResult> {
  const prefs = getGoogleCalendarPrefs();
  if (!prefs.connected || !prefs.autoSync) {
    // Still drop local mapping if present
    if (getGoogleCalendarEventId(bookingId)) {
      removeGoogleCalendarEventId(bookingId);
    }
    return { ok: true, skipped: true };
  }
  return deleteGoogleCalendarEvent(bookingId);
}

/** Push every booking that is not already mapped. */
export async function syncBookingsToGoogle(
  inputs: CalendarEventInput[],
): Promise<{ created: number; failed: number; lastError?: string }> {
  let created = 0;
  let failed = 0;
  let lastError: string | undefined;

  for (const input of inputs) {
    if (getGoogleCalendarEventId(input.booking.id)) continue;
    const res = await createGoogleCalendarEvent(input);
    if (res.ok) created += 1;
    else {
      failed += 1;
      lastError = res.error;
      if (res.needsReconnect) break;
    }
  }

  return { created, failed, lastError };
}

export { CALENDAR_SCOPE };

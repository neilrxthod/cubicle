/**
 * Client-side Google Calendar connection + booking→event map.
 * Event IDs are per-browser; reconnect still works for new bookings.
 */

const STORAGE_KEY = "cubicle_gcal_v1";
const PENDING_KEY = "cubicle_gcal_pending_connect";
const CHANGE_EVENT = "cubicle_gcal_change";

export type GoogleCalendarPrefs = {
  /** User opted in and completed OAuth with calendar scope. */
  connected: boolean;
  connectedAt?: string;
  /** Auto-push new bookings / remove canceled ones. */
  autoSync: boolean;
  /** bookingId → Google Calendar event id */
  eventIds: Record<string, string>;
};

const DEFAULT_PREFS: GoogleCalendarPrefs = {
  connected: false,
  autoSync: true,
  eventIds: {},
};

function notify() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeGoogleCalendarPrefs(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function getGoogleCalendarPrefs(): GoogleCalendarPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_PREFS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS, eventIds: {} };
    const parsed = JSON.parse(raw) as Partial<GoogleCalendarPrefs>;
    return {
      connected: Boolean(parsed.connected),
      connectedAt: parsed.connectedAt,
      autoSync: parsed.autoSync !== false,
      eventIds:
        parsed.eventIds && typeof parsed.eventIds === "object"
          ? { ...parsed.eventIds }
          : {},
    };
  } catch {
    return { ...DEFAULT_PREFS, eventIds: {} };
  }
}

function write(prefs: GoogleCalendarPrefs) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  notify();
}

export function setGoogleCalendarConnected(connected: boolean) {
  const prefs = getGoogleCalendarPrefs();
  write({
    ...prefs,
    connected,
    connectedAt: connected ? new Date().toISOString() : undefined,
  });
}

export function setGoogleCalendarAutoSync(autoSync: boolean) {
  const prefs = getGoogleCalendarPrefs();
  write({ ...prefs, autoSync });
}

export function setGoogleCalendarEventId(bookingId: string, eventId: string) {
  const prefs = getGoogleCalendarPrefs();
  write({
    ...prefs,
    eventIds: { ...prefs.eventIds, [bookingId]: eventId },
  });
}

export function getGoogleCalendarEventId(bookingId: string): string | undefined {
  return getGoogleCalendarPrefs().eventIds[bookingId];
}

export function removeGoogleCalendarEventId(bookingId: string) {
  const prefs = getGoogleCalendarPrefs();
  if (!prefs.eventIds[bookingId]) return;
  const next = { ...prefs.eventIds };
  delete next[bookingId];
  write({ ...prefs, eventIds: next });
}

export function clearGoogleCalendarPrefs() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(PENDING_KEY);
  notify();
}

/** Mark that the next OAuth return should enable calendar connect. */
export function markPendingCalendarConnect() {
  if (typeof window === "undefined") return;
  localStorage.setItem(PENDING_KEY, "1");
}

export function consumePendingCalendarConnect(): boolean {
  if (typeof window === "undefined") return false;
  const pending = localStorage.getItem(PENDING_KEY) === "1";
  if (pending) localStorage.removeItem(PENDING_KEY);
  return pending;
}

export function isPendingCalendarConnect(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(PENDING_KEY) === "1";
}

/**
 * Local-dev email testing controls (browser only).
 *
 * Production never reads this store. Server also re-checks isLocalDevRuntime()
 * before honoring any sink override — client cannot force production sends
 * to a personal inbox.
 */

import { isValidEmailShape } from "@/lib/auth/validation";
import { isLocalDevRuntime } from "@/lib/data/durability";

export const LOCAL_EMAIL_PREFS_KEY = "cubicle_email_dev_v1";
export const LOCAL_EMAIL_PREFS_CHANGE = "cubicle_email_dev_change";

export type LocalEmailPrefs = {
  /** When false (default), no Brevo calls leave this machine. */
  enabled: boolean;
  /** Sink address — all local notification mail is rewritten to this inbox. */
  testEmail: string;
};

const DEFAULTS: LocalEmailPrefs = {
  enabled: false,
  testEmail: "",
};

function read(): LocalEmailPrefs {
  if (typeof window === "undefined") return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(LOCAL_EMAIL_PREFS_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<LocalEmailPrefs>;
    return {
      enabled: parsed.enabled === true,
      testEmail:
        typeof parsed.testEmail === "string" ? parsed.testEmail.trim() : "",
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function write(prefs: LocalEmailPrefs) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_EMAIL_PREFS_KEY, JSON.stringify(prefs));
    window.dispatchEvent(new Event(LOCAL_EMAIL_PREFS_CHANGE));
  } catch {
    // private mode / quota
  }
}

export function getLocalEmailPrefs(): LocalEmailPrefs {
  return read();
}

export function setLocalEmailPrefs(
  partial: Partial<LocalEmailPrefs>,
): LocalEmailPrefs {
  const next: LocalEmailPrefs = {
    ...read(),
    ...partial,
  };
  if (typeof next.testEmail === "string") {
    next.testEmail = next.testEmail.trim();
  }
  next.enabled = next.enabled === true;
  write(next);
  return next;
}

/** True only in local runtime (client). Production UI never shows the section. */
export function showLocalEmailTestingUi(): boolean {
  return isLocalDevRuntime();
}

/**
 * Whether the client should even call `/api/notifications` in this environment.
 * Production always may queue. Local only when toggle is on + email looks valid.
 */
export function shouldQueueEmailFromClient(): boolean {
  if (!isLocalDevRuntime()) return true;
  const prefs = read();
  return prefs.enabled === true && isValidEmailShape(prefs.testEmail);
}

/**
 * Payload fragment attached to notification requests in local dev only.
 * Server ignores this unless isLocalDevRuntime() is true server-side.
 */
export function localEmailSinkForRequest():
  | { enabled: true; testEmail: string }
  | undefined {
  if (!isLocalDevRuntime()) return undefined;
  const prefs = read();
  if (!prefs.enabled || !isValidEmailShape(prefs.testEmail)) return undefined;
  return { enabled: true, testEmail: prefs.testEmail.trim().toLowerCase() };
}

export function isValidLocalTestEmail(email: string): boolean {
  return isValidEmailShape(email);
}

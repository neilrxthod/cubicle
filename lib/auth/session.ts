import type { SessionUser } from "./types";

const SESSION_KEY = "cubicle_session";
const SESSION_CHANGE_EVENT = "cubicle_session_change";
/**
 * Opaque presence flag only. Never store user ids, emails, tokens, or other
 * PII in localStorage — identity lives in memory for this tab and is restored
 * from Supabase auth cookies when needed.
 */
const SESSION_PRESENT = "1";

let cachedRaw: string | null | undefined;
let cachedUser: SessionUser | null = null;
let memoryUser: SessionUser | null = null;

function readSessionFromStorage(): SessionUser | null {
  if (typeof window === "undefined") return memoryUser;

  const raw = localStorage.getItem(SESSION_KEY);

  if (raw === cachedRaw) {
    return cachedUser;
  }

  if (!raw) {
    cachedRaw = raw;
    memoryUser = null;
    cachedUser = null;
    return null;
  }

  // Upgrade legacy markers that stored user ids as cleartext.
  if (raw !== SESSION_PRESENT) {
    localStorage.setItem(SESSION_KEY, SESSION_PRESENT);
    cachedRaw = SESSION_PRESENT;
  } else {
    cachedRaw = raw;
  }

  // Any non-empty marker means "a session was marked present"; the actual
  // SessionUser is memory-only (or rehydrated via Supabase, not this key).
  cachedUser = memoryUser;
  return cachedUser;
}

function notifySessionChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SESSION_CHANGE_EVENT));
}

export function subscribeToSession(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener(SESSION_CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener(SESSION_CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export function getSessionSnapshot(): SessionUser | null {
  return readSessionFromStorage();
}

export function getSession(): SessionUser | null {
  return readSessionFromStorage();
}

export function setSession(user: SessionUser): void {
  memoryUser = user;
  if (typeof window !== "undefined") {
    localStorage.setItem(SESSION_KEY, SESSION_PRESENT);
  }
  cachedRaw = SESSION_PRESENT;
  cachedUser = user;
  notifySessionChange();
}

export function clearSession(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(SESSION_KEY);
  }
  cachedRaw = null;
  cachedUser = null;
  memoryUser = null;
  notifySessionChange();
}

export function getDashboardPath(role: SessionUser["role"]): string {
  return role === "admin" ? "/admin" : "/";
}

import type { SessionUser } from "./types";

const SESSION_KEY = "cubicle_session";
const SESSION_CHANGE_EVENT = "cubicle_session_change";

let cachedRaw: string | null | undefined;
let cachedUser: SessionUser | null = null;

function readSessionFromStorage(): SessionUser | null {
  if (typeof window === "undefined") return null;

  const raw = localStorage.getItem(SESSION_KEY);

  if (raw === cachedRaw) {
    return cachedUser;
  }

  cachedRaw = raw;

  if (!raw) {
    cachedUser = null;
    return null;
  }

  try {
    cachedUser = JSON.parse(raw) as SessionUser;
    return cachedUser;
  } catch {
    cachedUser = null;
    return null;
  }
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
  const raw = JSON.stringify(user);
  localStorage.setItem(SESSION_KEY, raw);
  cachedRaw = raw;
  cachedUser = user;
  notifySessionChange();
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
  cachedRaw = null;
  cachedUser = null;
  notifySessionChange();
}

export function getDashboardPath(role: SessionUser["role"]): string {
  return role === "admin" ? "/admin" : "/";
}

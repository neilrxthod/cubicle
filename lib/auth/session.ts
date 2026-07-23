import type { SessionUser } from "./types";

const SESSION_KEY = "cubicle_session";
const SESSION_CHANGE_EVENT = "cubicle_session_change";

let cachedRaw: string | null | undefined;
let cachedUser: SessionUser | null = null;
let memoryUser: SessionUser | null = null;

function readSessionFromStorage(): SessionUser | null {
  if (typeof window === "undefined") return memoryUser;

  const raw = localStorage.getItem(SESSION_KEY);

  if (raw === cachedRaw) {
    return cachedUser;
  }

  cachedRaw = raw;

  if (!raw) {
    memoryUser = null;
    cachedUser = null;
    return null;
  }

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
  const marker = user.id;
  localStorage.setItem(SESSION_KEY, marker);
  cachedRaw = marker;
  cachedUser = user;
  notifySessionChange();
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
  cachedRaw = null;
  cachedUser = null;
  memoryUser = null;
  notifySessionChange();
}

export function getDashboardPath(role: SessionUser["role"]): string {
  return role === "admin" ? "/admin" : "/";
}

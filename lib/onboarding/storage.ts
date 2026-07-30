import type { Role } from "@/lib/types";

const KEY = "cubicle_onboarding_v1";
const CHANGE = "cubicle_onboarding_change";

export type OnboardingPrefs = {
  completed: boolean;
  completedAt?: string;
  title?: string;
  department?: string;
  /** Preferred periods for faster booking (teacher). */
  preferredPeriods?: string[];
  notifyEmail?: boolean;
  notifyIssues?: boolean;
  /** Admin: max advance booking days. */
  maxAdvanceDays?: number;
  /** Admin: confirmed cart fleet on first setup. */
  confirmedFleet?: boolean;
  /** Pattern notes — free text for personalization. */
  patternNote?: string;
};

type Store = Record<string, OnboardingPrefs>;

function readStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Store;
  } catch {
    return {};
  }
}

function writeStore(store: Store) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(store));
  window.dispatchEvent(new Event(CHANGE));
}

export function getOnboarding(userId: string): OnboardingPrefs {
  return readStore()[userId] ?? { completed: false };
}

export function isOnboardingComplete(userId: string): boolean {
  return Boolean(getOnboarding(userId).completed);
}

export function setOnboarding(userId: string, prefs: OnboardingPrefs) {
  const store = readStore();
  store[userId] = prefs;
  writeStore(store);
}

export function completeOnboarding(
  userId: string,
  prefs: Omit<OnboardingPrefs, "completed" | "completedAt">,
) {
  setOnboarding(userId, {
    ...prefs,
    completed: true,
    completedAt: new Date().toISOString(),
  });
}

export function subscribeOnboarding(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CHANGE, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function onboardingHomeForRole(role: Role) {
  return role === "admin" ? "/admin" : "/";
}

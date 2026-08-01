import type { Period, Role } from "@/lib/types";

const KEY = "cubicle_onboarding_v2";
const LEGACY_KEY = "cubicle_onboarding_v1";
const DRAFT_KEY = "cubicle_onboarding_draft_v1";
const CHANGE = "cubicle_onboarding_change";

/** High-school grades supported in Cubicle. */
export type Grade = 9 | 10 | 11 | 12;

export const GRADES: Grade[] = [9, 10, 11, 12];

/** Common high-school subjects for fast onboarding picks. */
export const SUBJECT_SUGGESTIONS = [
  "Biology",
  "Chemistry",
  "Physics",
  "Math",
  "English",
  "History",
  "Geography",
  "French",
  "Art",
  "Music",
  "Physical Education",
  "Computer Science",
  "Business",
  "Drama",
] as const;

/**
 * One teaching load: a subject taught to one or more grades in specific periods.
 * Teachers often have several of these (e.g. Bio 10 P1–P2, Chem 11 P3–P4).
 */
export type TeachingAssignment = {
  id: string;
  subject: string;
  grades: Grade[];
  periods: Period[];
};

export type OnboardingPrefs = {
  completed: boolean;
  completedAt?: string;
  title?: string;
  department?: string;
  /** Preferred periods (derived from teaching loads for teachers). */
  preferredPeriods?: string[];
  /** Teacher: full teaching schedule collected at first sign-in. */
  teachingAssignments?: TeachingAssignment[];
  notifyEmail?: boolean;
  notifyIssues?: boolean;
  /** Admin: max advance booking days. */
  maxAdvanceDays?: number;
  /** Admin: confirmed cart fleet on first setup. */
  confirmedFleet?: boolean;
  /** Pattern notes — free text for personalization. */
  patternNote?: string;
  /** Soft-skipped admin fleet confirm (can finish in Admin). */
  fleetDeferred?: boolean;
  /** Optional classroom / office room label. */
  room?: string;
};

/** In-progress wizard state (autosave). */
export type OnboardingDraft = {
  stepIndex: number;
  avatarDataUrl?: string | null;
  assignments?: TeachingAssignment[];
  maxAdvanceDays?: number;
  updatedAt: string;
};

type Store = Record<string, OnboardingPrefs>;
type DraftStore = Record<string, OnboardingDraft>;

function readStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Store;
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as Store;
      localStorage.setItem(KEY, legacy);
      return parsed;
    }
    return {};
  } catch {
    return {};
  }
}

function writeStore(store: Store) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(store));
  window.dispatchEvent(new Event(CHANGE));
}

function readDraftStore(): DraftStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as DraftStore) : {};
  } catch {
    return {};
  }
}

function writeDraftStore(store: DraftStore) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
}

function draftKeys(...keys: Array<string | undefined | null>): string[] {
  return Array.from(
    new Set(keys.filter((k): k is string => Boolean(k && k.trim()))),
  );
}

/** Merge prefs stored under either session id or email. */
export function getOnboarding(
  ...keys: Array<string | undefined | null>
): OnboardingPrefs {
  const store = readStore();
  const found: OnboardingPrefs[] = [];
  for (const key of keys) {
    if (!key) continue;
    const entry = store[key];
    if (entry) found.push(entry);
  }
  if (found.length === 0) return { completed: false };
  return found.reduce((best, cur) => {
    const bestHasTeaching = (best.teachingAssignments?.length ?? 0) > 0;
    const curHasTeaching = (cur.teachingAssignments?.length ?? 0) > 0;
    if (curHasTeaching && !bestHasTeaching) return cur;
    if (cur.completed && !best.completed) return cur;
    return best;
  });
}

export function isAssignmentComplete(a: TeachingAssignment): boolean {
  return (
    a.subject.trim().length > 0 &&
    a.grades.length > 0 &&
    a.periods.length > 0
  );
}

function hasTeachingLoad(prefs: OnboardingPrefs): boolean {
  return (prefs.teachingAssignments ?? []).some(isAssignmentComplete);
}

/**
 * Whether this user still needs the post-sign-in teaching setup card.
 * Teachers who finished the old wizard without a teaching load are re-prompted.
 */
export function needsOnboarding(
  role: Role,
  ...keys: Array<string | undefined | null>
): boolean {
  const prefs = getOnboarding(...keys);
  if (role === "admin") {
    return !prefs.completed;
  }
  if (!hasTeachingLoad(prefs)) return true;
  return !prefs.completed;
}

/** @deprecated use needsOnboarding — kept for call sites that only pass a key */
export function isOnboardingComplete(userId: string): boolean {
  return !needsOnboarding("teacher", userId);
}

export function setOnboarding(userId: string, prefs: OnboardingPrefs) {
  const store = readStore();
  store[userId] = prefs;
  writeStore(store);
}

export function completeOnboarding(
  userId: string,
  prefs: Omit<OnboardingPrefs, "completed" | "completedAt">,
  mirrorKeys: Array<string | undefined | null> = [],
) {
  const next: OnboardingPrefs = {
    ...prefs,
    completed: true,
    completedAt: new Date().toISOString(),
  };
  const store = readStore();
  const keys = [userId, ...mirrorKeys].filter(
    (k): k is string => Boolean(k && k.trim()),
  );
  for (const key of Array.from(new Set(keys))) {
    store[key] = next;
  }
  writeStore(store);
  clearOnboardingDraft(...keys);
}

/**
 * Update onboarding prefs after first-run (Settings).
 * Always keeps `completed: true` so production never reopens the wizard.
 */
export function saveOnboardingPrefs(
  userId: string,
  patch: Partial<Omit<OnboardingPrefs, "completed" | "completedAt">>,
  mirrorKeys: Array<string | undefined | null> = [],
) {
  const keys = [userId, ...mirrorKeys].filter(
    (k): k is string => Boolean(k && k.trim()),
  );
  if (keys.length === 0) return;
  const current = getOnboarding(...keys);
  const next: OnboardingPrefs = {
    ...current,
    ...patch,
    completed: true,
    completedAt: current.completedAt ?? new Date().toISOString(),
  };
  const store = readStore();
  for (const key of Array.from(new Set(keys))) {
    store[key] = next;
  }
  writeStore(store);
}

/** Clear teaching-setup state for the given user keys (id / email). */
export function resetOnboarding(
  ...keys: Array<string | undefined | null>
): void {
  if (typeof window === "undefined") return;
  const store = readStore();
  let changed = false;
  for (const key of keys) {
    if (!key) continue;
    if (key in store) {
      delete store[key];
      changed = true;
    }
  }
  if (changed) writeStore(store);
  clearOnboardingDraft(...keys);
}

/**
 * Local `next dev` only: re-show the post-auth teaching card after every sign-in.
 * Production keeps one-time onboarding.
 */
export function shouldRepromptOnboardingAfterAuth(): boolean {
  return process.env.NODE_ENV === "development";
}

/** Call after a successful sign-in so /onboarding always shows in local dev. */
export function prepareOnboardingAfterAuth(
  ...keys: Array<string | undefined | null>
): void {
  if (!shouldRepromptOnboardingAfterAuth()) return;
  resetOnboarding(...keys);
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

/** After onboarding, land on Schedule for every role (not Admin). */
export function onboardingHomeForRole(
  _role: Role,
  opts?: { firstRun?: boolean },
) {
  if (opts?.firstRun) {
    return "/?firstRun=1";
  }
  return "/";
}

export function newTeachingAssignment(): TeachingAssignment {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `ta_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    subject: "",
    grades: [],
    periods: [],
  };
}

export function periodsFromAssignments(
  assignments: TeachingAssignment[],
): Period[] {
  const set = new Set<Period>();
  for (const a of assignments) {
    for (const p of a.periods) set.add(p);
  }
  return (["P1", "P2", "P3", "P4", "P5"] as Period[]).filter((p) =>
    set.has(p),
  );
}

export function subjectsFromAssignments(
  assignments: TeachingAssignment[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const a of assignments) {
    const s = a.subject.trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/**
 * Periods claimed by other assignments (same teacher load).
 * Used to warn when one subject reuses another's period.
 */
export function conflictingPeriodsForAssignment(
  assignments: TeachingAssignment[],
  assignmentId: string,
): Period[] {
  const current = assignments.find((a) => a.id === assignmentId);
  if (!current) return [];
  const claimed = new Set<Period>();
  for (const a of assignments) {
    if (a.id === assignmentId) continue;
    if (!a.subject.trim() && a.periods.length === 0) continue;
    for (const p of a.periods) claimed.add(p);
  }
  return current.periods.filter((p) => claimed.has(p));
}

/** True if any period is used on more than one non-empty assignment. */
export function hasPeriodConflicts(assignments: TeachingAssignment[]): boolean {
  const counts = new Map<Period, number>();
  for (const a of assignments) {
    if (!a.subject.trim() && a.periods.length === 0) continue;
    for (const p of a.periods) {
      counts.set(p, (counts.get(p) ?? 0) + 1);
    }
  }
  for (const n of counts.values()) {
    if (n > 1) return true;
  }
  return false;
}

export function filterSubjectSuggestions(
  query: string,
  limit = 6,
): string[] {
  const q = query.trim().toLowerCase();
  // No empty-query defaults — only filter once the teacher starts typing.
  if (!q) return [];
  return SUBJECT_SUGGESTIONS.filter((s) => s.toLowerCase().includes(q)).slice(
    0,
    limit,
  );
}

/* ─── Draft autosave ─────────────────────────────────────── */

export function getOnboardingDraft(
  ...keys: Array<string | undefined | null>
): OnboardingDraft | null {
  const store = readDraftStore();
  for (const key of draftKeys(...keys)) {
    if (store[key]) return store[key];
  }
  return null;
}

export function saveOnboardingDraft(
  draft: Omit<OnboardingDraft, "updatedAt">,
  ...keys: Array<string | undefined | null>
): void {
  const ids = draftKeys(...keys);
  if (ids.length === 0) return;
  const store = readDraftStore();
  const next: OnboardingDraft = {
    ...draft,
    updatedAt: new Date().toISOString(),
  };
  for (const key of ids) {
    store[key] = next;
  }
  writeDraftStore(store);
}

export function clearOnboardingDraft(
  ...keys: Array<string | undefined | null>
): void {
  const store = readDraftStore();
  let changed = false;
  for (const key of draftKeys(...keys)) {
    if (key in store) {
      delete store[key];
      changed = true;
    }
  }
  if (changed) writeDraftStore(store);
}



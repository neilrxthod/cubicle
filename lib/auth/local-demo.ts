/**
 * Local-development only: fixed Admin + Teacher personas so product work
 * can exercise both perspectives without production data.
 *
 * Operational data (carts, bookings, issues) starts empty — add it in the UI.
 * Never active when remote platform / production deploy is on.
 */

import type { DemoAccount, SessionUser as AuthSessionUser } from "@/lib/auth/types";
import { setSession } from "@/lib/auth/session";
import {
  isLocalDemoMode,
  localWriteBlockReason,
} from "@/lib/data/durability";
import { getState, mutate } from "@/lib/data/platform-store";
import { completeOnboarding } from "@/lib/onboarding/storage";
import type { Grade } from "@/lib/onboarding/storage";
import type { Period, PlatformState, SessionUser, User } from "@/lib/types";

export const LOCAL_DEMO_ADMIN_ID = "local-demo-admin";
export const LOCAL_DEMO_TEACHER_ID = "local-demo-teacher";

/** Bump when seed shape changes so local browsers drop leftover dummy data. */
const LOCAL_DEMO_SEED_REVISION = 7;
const SEED_REVISION_KEY = "cubicle_local_demo_seed_revision";

/** Legacy dummy rows from older local sandbox seeds — never re-insert these. */
const LEGACY_DUMMY_CART_IDS = new Set([
  "local-demo-cart-a",
  "local-demo-cart-b",
  "local-demo-cart-c",
  "local-demo-cart-d",
]);
const LEGACY_DUMMY_BOOKING_IDS = new Set([
  "local-demo-booking-1",
  "local-demo-booking-2",
]);
const LEGACY_DUMMY_USER_IDS = new Set(["local-demo-teacher-b"]);
const LEGACY_DUMMY_USER_EMAILS = new Set(["demo.teacher2@rbe.sk.ca"]);

/**
 * Sample portrait photos for local sandbox personas (served from /public/demo).
 * Distinct faces so Admin vs Teacher perspectives are obvious in the UI.
 */
const DEMO_AVATAR = {
  admin: "/demo/alex-admin.jpg",
  teacher: "/demo/taylor-teacher.jpg",
} as const;

/** Fixed admin identity for the local sandbox. */
export const LOCAL_DEMO_ADMIN: SessionUser = {
  id: LOCAL_DEMO_ADMIN_ID,
  email: "demo.admin@rbe.sk.ca",
  name: "Alex Admin",
  firstName: "Alex",
  lastName: "Admin",
  role: "admin",
  avatarUrl: DEMO_AVATAR.admin,
  title: "IT Administrator",
  department: "Technology",
  employmentType: "permanent",
  notifyEmail: true,
  notifyIssues: true,
};

/** Fixed teacher identity for the local sandbox. */
export const LOCAL_DEMO_TEACHER: SessionUser = {
  id: LOCAL_DEMO_TEACHER_ID,
  email: "demo.teacher@rbe.sk.ca",
  name: "Taylor Teacher",
  firstName: "Taylor",
  lastName: "Teacher",
  role: "teacher",
  avatarUrl: DEMO_AVATAR.teacher,
  title: "Science Teacher",
  department: "Science",
  employmentType: "permanent",
  notifyEmail: true,
  notifyIssues: true,
};

/** Extra local-only staff so share search / long lists can be judged in the UI. */
const SEED_STAFF: Array<{
  first: string;
  last: string;
  department: string;
  title: string;
  avatarUrl?: string;
}> = [
  {
    first: "Jordan",
    last: "Lee",
    department: "English",
    title: "English Teacher",
    avatarUrl: "/demo/jordan-lee.jpg",
  },
  { first: "Priya", last: "Patel", department: "Math", title: "Math Teacher" },
  { first: "Marcus", last: "Chen", department: "Science", title: "Chemistry Teacher" },
  { first: "Amina", last: "Hassan", department: "Social Studies", title: "History Teacher" },
  { first: "Noah", last: "Brooks", department: "Phys Ed", title: "PE Teacher" },
  { first: "Sofia", last: "Reyes", department: "Languages", title: "French Teacher" },
  { first: "Liam", last: "Okoye", department: "Arts", title: "Visual Arts Teacher" },
  { first: "Emily", last: "Park", department: "Math", title: "Math Teacher" },
  { first: "Daniel", last: "Nguyen", department: "Science", title: "Physics Teacher" },
  { first: "Chloe", last: "Martin", department: "English", title: "English Teacher" },
  { first: "Hassan", last: "Ali", department: "Technology", title: "Computer Science" },
  { first: "Maya", last: "Singh", department: "Guidance", title: "Counsellor" },
  { first: "Owen", last: "Clarke", department: "Music", title: "Band Teacher" },
  { first: "Isla", last: "Berg", department: "Science", title: "Biology Teacher" },
];

function seedStaffPersona(row: (typeof SEED_STAFF)[number]): SessionUser {
  const slug = `${row.first}.${row.last}`.toLowerCase().replace(/\s+/g, "");
  return {
    id: `local-seed-staff-${slug}`,
    email: `seed.${slug}@rbe.sk.ca`,
    name: `${row.first} ${row.last}`,
    firstName: row.first,
    lastName: row.last,
    role: "teacher",
    avatarUrl: row.avatarUrl,
    title: row.title,
    department: row.department,
    employmentType: "permanent",
    notifyEmail: true,
    notifyIssues: true,
  };
}

const SEED_USERS: Array<{ persona: SessionUser; password: string }> = [
  { persona: LOCAL_DEMO_ADMIN, password: "demo-admin" },
  { persona: LOCAL_DEMO_TEACHER, password: "demo-teacher" },
  ...SEED_STAFF.map((row) => ({
    persona: seedStaffPersona(row),
    password: "demo-staff",
  })),
];

function toUser(persona: SessionUser, password: string): User {
  return {
    ...persona,
    password,
    allowlisted: true,
  };
}

function toDemoAccount(
  persona: SessionUser,
  password: string,
  label: string,
): DemoAccount {
  return {
    id: persona.id,
    email: persona.email,
    name: persona.name,
    firstName: persona.firstName,
    lastName: persona.lastName,
    role: persona.role,
    avatarUrl: persona.avatarUrl,
    title: persona.title,
    department: persona.department,
    employmentType: persona.employmentType,
    password,
    label,
  };
}

function readSeedRevision(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(SEED_REVISION_KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function writeSeedRevision(revision: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SEED_REVISION_KEY, String(revision));
  } catch {
    // ignore quota / private mode
  }
}

/** True only in the isolated browser sandbox (never production / remote). */
export function isLocalPerspectiveSwitcherEnabled(): boolean {
  return isLocalDemoMode();
}

export function isLocalDemoPersona(
  user: Pick<SessionUser, "id" | "email"> | null | undefined,
): boolean {
  if (!user) return false;
  const id = user.id ?? "";
  const email = user.email.toLowerCase();
  return (
    id === LOCAL_DEMO_ADMIN_ID ||
    id === LOCAL_DEMO_TEACHER_ID ||
    email === LOCAL_DEMO_ADMIN.email ||
    email === LOCAL_DEMO_TEACHER.email
  );
}

export function getLocalDemoPersona(
  role: "admin" | "teacher",
): SessionUser {
  return role === "admin" ? { ...LOCAL_DEMO_ADMIN } : { ...LOCAL_DEMO_TEACHER };
}

/** Login picker accounts — only when local sandbox is active. */
export function getLocalDemoAccounts(): DemoAccount[] {
  if (!isLocalDemoMode()) return [];
  return [
    toDemoAccount(LOCAL_DEMO_ADMIN, "demo-admin", "Demo Admin"),
    toDemoAccount(LOCAL_DEMO_TEACHER, "demo-teacher", "Demo Teacher"),
  ];
}

/** A few seed staff appear online so presence dots can be judged locally. */
export function getLocalDemoPreviewOnlineIds(): string[] {
  if (!isLocalDemoMode()) return [];
  return [
    LOCAL_DEMO_ADMIN_ID,
    LOCAL_DEMO_TEACHER_ID,
    "local-seed-staff-jordan.lee",
    "local-seed-staff-priya.patel",
    "local-seed-staff-marcus.chen",
    "local-seed-staff-amina.hassan",
  ];
}

/**
 * Mark demo personas as finished with first-run setup so perspective
 * switches never trap you in the onboarding wizard.
 */
export function completeLocalDemoOnboarding(user?: SessionUser): void {
  if (typeof window === "undefined") return;
  if (!isLocalDemoMode()) return;

  const teacherGrades: Grade[] = [10, 11];
  const teacherPeriods: Period[] = ["P1", "P2"];
  const teacherPrefs = {
    title: LOCAL_DEMO_TEACHER.title,
    department: LOCAL_DEMO_TEACHER.department,
    teachingAssignments: [
      {
        id: "local-demo-load-1",
        subject: "Biology",
        grades: teacherGrades,
        periods: teacherPeriods,
      },
    ],
    preferredPeriods: ["P1", "P2"],
    notifyEmail: true,
    notifyIssues: true,
  };

  const adminPrefs = {
    title: LOCAL_DEMO_ADMIN.title,
    department: LOCAL_DEMO_ADMIN.department,
    maxAdvanceDays: 14,
    confirmedFleet: true,
    notifyEmail: true,
    notifyIssues: true,
  };

  completeOnboarding(LOCAL_DEMO_TEACHER_ID, teacherPrefs, [
    LOCAL_DEMO_TEACHER.email,
  ]);
  completeOnboarding(LOCAL_DEMO_ADMIN_ID, adminPrefs, [
    LOCAL_DEMO_ADMIN.email,
  ]);

  if (user) {
    completeOnboarding(
      user.id,
      user.role === "admin" ? adminPrefs : teacherPrefs,
      [user.email],
    );
  }
}

function isDemoSampleAvatar(url: string | undefined): boolean {
  if (!url) return true;
  // Treat missing, legacy empty, or our bundled sample paths as replaceable.
  return (
    url.startsWith("/demo/") ||
    url.includes("/demo/") ||
    url.trim() === ""
  );
}

function upsertSeedUsers(
  draft: {
    users: User[];
  },
  options?: { forceDemoAvatars?: boolean },
): void {
  const forceAvatars = options?.forceDemoAvatars === true;
  for (const { persona, password } of SEED_USERS) {
    const email = persona.email.toLowerCase();
    const idx = draft.users.findIndex(
      (u) => u.id === persona.id || u.email.toLowerCase() === email,
    );
    const next = toUser(persona, password);
    if (idx >= 0) {
      const prev = draft.users[idx];
      // Keep a custom photo the dev uploaded; always re-apply sample pfps when
      // missing or when this seed revision upgrades demo faces.
      const keepCustom =
        !forceAvatars &&
        Boolean(prev.avatarUrl) &&
        !isDemoSampleAvatar(prev.avatarUrl);
      draft.users[idx] = {
        ...prev,
        ...next,
        avatarUrl: keepCustom ? prev.avatarUrl : next.avatarUrl,
        password: next.password,
        allowlisted: true,
      };
    } else {
      draft.users.push(next);
    }
  }
}

function hasLegacyDummyData(state: PlatformState): boolean {
  if (state.carts.some((c) => LEGACY_DUMMY_CART_IDS.has(c.id))) return true;
  if (state.bookings.some((b) => LEGACY_DUMMY_BOOKING_IDS.has(b.id))) return true;
  if (state.bookings.some((b) => LEGACY_DUMMY_CART_IDS.has(b.cartId))) return true;
  if (state.issues.some((i) => LEGACY_DUMMY_CART_IDS.has(i.cartId))) return true;
  if (state.slotRestrictions.some((r) => LEGACY_DUMMY_CART_IDS.has(r.cartId))) {
    return true;
  }
  if (
    state.users.some(
      (u) =>
        LEGACY_DUMMY_USER_IDS.has(u.id) ||
        LEGACY_DUMMY_USER_EMAILS.has(u.email.toLowerCase()),
    )
  ) {
    return true;
  }
  return false;
}

/** Drop leftover sample carts / bookings so deletes are not immediately restored. */
function stripLegacyDummyData(draft: PlatformState): void {
  draft.carts = draft.carts.filter((c) => !LEGACY_DUMMY_CART_IDS.has(c.id));
  draft.bookings = draft.bookings.filter(
    (b) =>
      !LEGACY_DUMMY_BOOKING_IDS.has(b.id) &&
      !LEGACY_DUMMY_CART_IDS.has(b.cartId),
  );
  const bookingIds = new Set(draft.bookings.map((b) => b.id));
  draft.issues = draft.issues.filter((i) => !LEGACY_DUMMY_CART_IDS.has(i.cartId));
  draft.slotRestrictions = draft.slotRestrictions.filter(
    (r) => !LEGACY_DUMMY_CART_IDS.has(r.cartId),
  );
  draft.swapRequests = draft.swapRequests.filter(
    (s) =>
      bookingIds.has(s.bookingId) &&
      (!s.offeredBookingId || bookingIds.has(s.offeredBookingId)),
  );
  draft.users = draft.users.filter(
    (u) =>
      !LEGACY_DUMMY_USER_IDS.has(u.id) &&
      !LEGACY_DUMMY_USER_EMAILS.has(u.email.toLowerCase()),
  );
}

/**
 * Ensure demo login personas exist. Does not seed carts or bookings.
 * Safe to call often — also strips leftover dummy operational data.
 */
export function ensureLocalDemoSandbox(): void {
  if (typeof window === "undefined") return;
  if (!isLocalDemoMode()) return;
  if (localWriteBlockReason()) return;

  const before = getState();
  const revision = readSeedRevision();
  const needsUpgrade = revision < LOCAL_DEMO_SEED_REVISION;
  const leftoverDummy = hasLegacyDummyData(before);

  const missingUser = SEED_USERS.some(
    ({ persona }) =>
      !before.users.some(
        (u) =>
          u.id === persona.id ||
          u.email.toLowerCase() === persona.email.toLowerCase(),
      ),
  );

  const missingAvatar = SEED_USERS.some(({ persona }) => {
    const u = before.users.find(
      (row) =>
        row.id === persona.id ||
        row.email.toLowerCase() === persona.email.toLowerCase(),
    );
    return !u?.avatarUrl;
  });

  if (!needsUpgrade && !leftoverDummy && !missingUser && !missingAvatar) {
    completeLocalDemoOnboarding();
    return;
  }

  mutate((draft) => {
    stripLegacyDummyData(draft);
    upsertSeedUsers(draft, {
      forceDemoAvatars: needsUpgrade || missingAvatar,
    });
    if (!draft.bookingPolicy) {
      draft.bookingPolicy = {
        maxAdvanceDays: 14,
        maxSlotsPerTeacherPerDay: 5,
      };
    } else {
      if (typeof draft.bookingPolicy.maxAdvanceDays !== "number") {
        draft.bookingPolicy.maxAdvanceDays = 14;
      }
      if (typeof draft.bookingPolicy.maxSlotsPerTeacherPerDay !== "number") {
        draft.bookingPolicy.maxSlotsPerTeacherPerDay = 5;
      }
    }
  });

  writeSeedRevision(LOCAL_DEMO_SEED_REVISION);
  completeLocalDemoOnboarding();
}

export type SwitchPerspectiveResult =
  | { ok: true; user: SessionUser }
  | { ok: false; error: string };

/**
 * Swap the signed-in session to the fixed Admin or Teacher demo identity.
 * Shared sandbox data (carts, bookings) stays in place.
 */
export function switchLocalPerspective(
  role: "admin" | "teacher",
): SwitchPerspectiveResult {
  if (!isLocalPerspectiveSwitcherEnabled()) {
    return {
      ok: false,
      error: "Perspective switch is only available in the local sandbox.",
    };
  }

  ensureLocalDemoSandbox();
  const user = getLocalDemoPersona(role);
  completeLocalDemoOnboarding(user);
  setSession(user as AuthSessionUser);
  return { ok: true, user };
}

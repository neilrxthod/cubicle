/**
 * Local-development only: fixed Admin + Teacher personas and a seeded sandbox
 * so product work can exercise both perspectives without production data.
 *
 * Never active when remote platform / production deploy is on.
 */

import { format } from "date-fns";
import type { DemoAccount, SessionUser as AuthSessionUser } from "@/lib/auth/types";
import { setSession } from "@/lib/auth/session";
import {
  isLocalDemoMode,
  localWriteBlockReason,
} from "@/lib/data/durability";
import { getState, mutate } from "@/lib/data/platform-store";
import { completeOnboarding } from "@/lib/onboarding/storage";
import type { Grade } from "@/lib/onboarding/storage";
import type { Booking, Cart, Period, SessionUser, User } from "@/lib/types";

export const LOCAL_DEMO_ADMIN_ID = "local-demo-admin";
export const LOCAL_DEMO_TEACHER_ID = "local-demo-teacher";
/** Second teacher so share / swap flows can be exercised locally. */
export const LOCAL_DEMO_TEACHER_B_ID = "local-demo-teacher-b";

/** Bump when seed shape changes so local browsers re-apply missing pieces. */
const LOCAL_DEMO_SEED_REVISION = 3;
const SEED_REVISION_KEY = "cubicle_local_demo_seed_revision";

/**
 * Sample portrait photos for local sandbox personas (served from /public/demo).
 * Distinct faces so Admin vs Teacher perspectives are obvious in the UI.
 */
const DEMO_AVATAR = {
  admin: "/demo/alex-admin.jpg",
  teacher: "/demo/taylor-teacher.jpg",
  teacherB: "/demo/jordan-lee.jpg",
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

/** Second teacher (for multi-user board / swap demos). Not a login switcher target. */
export const LOCAL_DEMO_TEACHER_B: SessionUser = {
  id: LOCAL_DEMO_TEACHER_B_ID,
  email: "demo.teacher2@rbe.sk.ca",
  name: "Jordan Lee",
  firstName: "Jordan",
  lastName: "Lee",
  role: "teacher",
  avatarUrl: DEMO_AVATAR.teacherB,
  title: "English Teacher",
  department: "English",
  employmentType: "permanent",
  notifyEmail: true,
  notifyIssues: true,
};

const SEED_CARTS: Cart[] = [
  {
    id: "local-demo-cart-a",
    name: "Cart A",
    status: "active",
    laptopCount: 30,
    location: "Library",
  },
  {
    id: "local-demo-cart-b",
    name: "Cart B",
    status: "active",
    laptopCount: 28,
    location: "Room 204",
  },
  {
    id: "local-demo-cart-c",
    name: "Cart C",
    status: "active",
    laptopCount: 32,
    location: "Science wing",
  },
  {
    id: "local-demo-cart-d",
    name: "Cart D",
    status: "maintenance",
    laptopCount: 24,
    location: "IT office",
  },
];

const SEED_USERS: Array<{ persona: SessionUser; password: string }> = [
  { persona: LOCAL_DEMO_ADMIN, password: "demo-admin" },
  { persona: LOCAL_DEMO_TEACHER, password: "demo-teacher" },
  { persona: LOCAL_DEMO_TEACHER_B, password: "demo-teacher" },
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

function todayYmd(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function buildSampleBookings(nowIso: string): Booking[] {
  const date = todayYmd();
  return [
    {
      id: "local-demo-booking-1",
      cartId: "local-demo-cart-a",
      date,
      period: "P1",
      teacherId: LOCAL_DEMO_TEACHER_ID,
      teacherName: LOCAL_DEMO_TEACHER.name,
      className: "Bio 10",
      subject: "Biology",
      createdAt: nowIso,
      lastEditedById: LOCAL_DEMO_TEACHER_ID,
      lastEditedByName: LOCAL_DEMO_TEACHER.name,
      lastEditedAt: nowIso,
    },
    {
      id: "local-demo-booking-2",
      cartId: "local-demo-cart-b",
      date,
      period: "P3",
      teacherId: LOCAL_DEMO_TEACHER_B_ID,
      teacherName: LOCAL_DEMO_TEACHER_B.name,
      className: "Eng 11",
      subject: "English",
      createdAt: nowIso,
      lastEditedById: LOCAL_DEMO_TEACHER_B_ID,
      lastEditedByName: LOCAL_DEMO_TEACHER_B.name,
      lastEditedAt: nowIso,
    },
  ];
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

  const teacherBPrefs = {
    title: LOCAL_DEMO_TEACHER_B.title,
    department: LOCAL_DEMO_TEACHER_B.department,
    teachingAssignments: [
      {
        id: "local-demo-load-2",
        subject: "English",
        grades: [11, 12] as Grade[],
        periods: ["P3", "P4"] as Period[],
      },
    ],
    preferredPeriods: ["P3", "P4"],
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
  completeOnboarding(LOCAL_DEMO_TEACHER_B_ID, teacherBPrefs, [
    LOCAL_DEMO_TEACHER_B.email,
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

function upsertSeedCarts(draft: { carts: Cart[] }): void {
  for (const seed of SEED_CARTS) {
    const idx = draft.carts.findIndex((c) => c.id === seed.id);
    if (idx >= 0) {
      // Restore canonical seed cart metadata without dropping user carts.
      draft.carts[idx] = { ...seed };
    } else {
      draft.carts.push({ ...seed });
    }
  }
}

function ensureSampleBookings(draft: {
  bookings: Booking[];
  carts: Cart[];
}): void {
  const cartIds = new Set(draft.carts.map((c) => c.id));
  const samples = buildSampleBookings(new Date().toISOString());
  for (const booking of samples) {
    if (!cartIds.has(booking.cartId)) continue;
    const exists = draft.bookings.some((b) => b.id === booking.id);
    if (exists) {
      // Refresh sample bookings to "today" so the board isn't stuck on old dates.
      draft.bookings = draft.bookings.map((b) =>
        b.id === booking.id
          ? {
              ...b,
              date: booking.date,
              cartId: booking.cartId,
              period: booking.period,
              teacherId: booking.teacherId,
              teacherName: booking.teacherName,
              className: booking.className,
              subject: booking.subject,
            }
          : b,
      );
      continue;
    }
    // Don't collide with an existing slot booking for the same cart/date/period.
    const slotTaken = draft.bookings.some(
      (b) =>
        b.cartId === booking.cartId &&
        b.date.slice(0, 10) === booking.date &&
        b.period === booking.period,
    );
    if (slotTaken) continue;
    draft.bookings.push(booking);
  }
}

/**
 * Ensure demo users, starter carts, and sample bookings exist.
 * Safe to call often — fills missing pieces and upgrades seed revision.
 */
export function ensureLocalDemoSandbox(): void {
  if (typeof window === "undefined") return;
  if (!isLocalDemoMode()) return;
  if (localWriteBlockReason()) return;

  const before = getState();
  const revision = readSeedRevision();
  const needsUpgrade = revision < LOCAL_DEMO_SEED_REVISION;

  const missingUser = SEED_USERS.some(
    ({ persona }) =>
      !before.users.some(
        (u) =>
          u.id === persona.id ||
          u.email.toLowerCase() === persona.email.toLowerCase(),
      ),
  );
  const missingCart = SEED_CARTS.some(
    (seed) => !before.carts.some((c) => c.id === seed.id),
  );
  const missingSampleBooking = buildSampleBookings(
    new Date().toISOString(),
  ).some((sample) => !before.bookings.some((b) => b.id === sample.id));

  const missingAvatar = SEED_USERS.some(({ persona }) => {
    const u = before.users.find(
      (row) =>
        row.id === persona.id ||
        row.email.toLowerCase() === persona.email.toLowerCase(),
    );
    return !u?.avatarUrl;
  });

  if (
    !needsUpgrade &&
    !missingUser &&
    !missingCart &&
    !missingSampleBooking &&
    !missingAvatar
  ) {
    completeLocalDemoOnboarding();
    return;
  }

  mutate((draft) => {
    // Seed rev 3+: force bundled sample faces onto demo personas.
    upsertSeedUsers(draft, {
      forceDemoAvatars: needsUpgrade || missingAvatar,
    });
    upsertSeedCarts(draft);
    // Policy defaults for local testing.
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
    ensureSampleBookings(draft);
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

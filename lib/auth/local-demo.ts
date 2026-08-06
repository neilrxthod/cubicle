/**
 * Local-development only: fixed Admin + Teacher personas and a seeded sandbox
 * so product work can exercise both perspectives without production data.
 *
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
import type { Cart, Period, SessionUser, User } from "@/lib/types";

export const LOCAL_DEMO_ADMIN_ID = "local-demo-admin";
export const LOCAL_DEMO_TEACHER_ID = "local-demo-teacher";

/** Fixed admin identity for the local sandbox. */
export const LOCAL_DEMO_ADMIN: SessionUser = {
  id: LOCAL_DEMO_ADMIN_ID,
  email: "demo.admin@rbe.sk.ca",
  name: "Alex Admin",
  firstName: "Alex",
  lastName: "Admin",
  role: "admin",
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
  title: "Science Teacher",
  department: "Science",
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
    title: persona.title,
    department: persona.department,
    employmentType: persona.employmentType,
    password,
    label,
  };
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
 * Mark both demo personas as finished with first-run setup so perspective
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
    completeOnboarding(user.id, user.role === "admin" ? adminPrefs : teacherPrefs, [
      user.email,
    ]);
  }
}

/**
 * Ensure demo users (and starter carts when the sandbox is empty) exist.
 * Safe to call often; only fills missing pieces.
 */
export function ensureLocalDemoSandbox(): void {
  if (typeof window === "undefined") return;
  if (!isLocalDemoMode()) return;
  if (localWriteBlockReason()) return;

  const before = getState();
  const hasAdmin = before.users.some(
    (u) =>
      u.id === LOCAL_DEMO_ADMIN_ID ||
      u.email.toLowerCase() === LOCAL_DEMO_ADMIN.email,
  );
  const hasTeacher = before.users.some(
    (u) =>
      u.id === LOCAL_DEMO_TEACHER_ID ||
      u.email.toLowerCase() === LOCAL_DEMO_TEACHER.email,
  );
  const seedCarts =
    before.carts.length === 0 &&
    before.bookings.length === 0 &&
    before.users.length === 0;

  if (hasAdmin && hasTeacher && !seedCarts) {
    completeLocalDemoOnboarding();
    return;
  }

  // Fresh empty sandbox: seed users + carts. Otherwise only inject missing personas.
  const injectCarts = before.carts.length === 0 && before.bookings.length === 0;

  mutate((draft) => {
    if (!draft.users.some((u) => u.id === LOCAL_DEMO_ADMIN_ID)) {
      draft.users = draft.users.filter(
        (u) => u.email.toLowerCase() !== LOCAL_DEMO_ADMIN.email,
      );
      draft.users.push(toUser(LOCAL_DEMO_ADMIN, "demo-admin"));
    }
    if (!draft.users.some((u) => u.id === LOCAL_DEMO_TEACHER_ID)) {
      draft.users = draft.users.filter(
        (u) => u.email.toLowerCase() !== LOCAL_DEMO_TEACHER.email,
      );
      draft.users.push(toUser(LOCAL_DEMO_TEACHER, "demo-teacher"));
    }
    if (injectCarts && draft.carts.length === 0) {
      draft.carts = SEED_CARTS.map((c) => ({ ...c }));
    }
  });

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

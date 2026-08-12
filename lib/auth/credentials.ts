import { getLocalDemoAccounts } from "./local-demo";
import type { DemoAccount, SessionUser } from "./types";

/**
 * Local password demo accounts.
 * Production uses Google OAuth + allowlist only.
 * When the local sandbox is active, Demo Admin / Demo Teacher appear here.
 * You can also force the picker with NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true
 * (still only works when local demo accounts are available).
 */
export function getDemoAccounts(): DemoAccount[] {
  return getLocalDemoAccounts();
}

/** @deprecated Prefer getDemoAccounts() — kept for older imports. */
export const DEMO_ACCOUNTS: DemoAccount[] = [];

export function authenticate(
  email: string,
  password: string,
): SessionUser | null {
  const account = getDemoAccounts().find(
    (entry) =>
      entry.email.toLowerCase() === email.trim().toLowerCase() &&
      entry.password === password,
  );

  if (!account) return null;

  return {
    id: account.id,
    email: account.email,
    name: account.name,
    firstName: account.firstName,
    lastName: account.lastName,
    role: account.role,
    avatarUrl: account.avatarUrl,
    title: account.title,
    department: account.department,
    employmentType: account.employmentType,
  };
}

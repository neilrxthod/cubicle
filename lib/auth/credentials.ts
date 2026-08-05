import type { DemoAccount, SessionUser } from "./types";

/**
 * Local password demo accounts — intentionally empty.
 * Production uses Google OAuth + allowlist only.
 * Set NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true only if you add accounts here for local UI work.
 */
export const DEMO_ACCOUNTS: DemoAccount[] = [];

export function authenticate(
  email: string,
  password: string,
): SessionUser | null {
  const account = DEMO_ACCOUNTS.find(
    (entry) =>
      entry.email.toLowerCase() === email.trim().toLowerCase() &&
      entry.password === password,
  );

  if (!account) return null;

  return {
    id: account.id,
    email: account.email,
    name: account.name,
    role: account.role,
    title: account.title,
    department: account.department,
    employmentType: account.employmentType,
  };
}

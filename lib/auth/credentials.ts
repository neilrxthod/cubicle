import type { DemoAccount, SessionUser } from "./types";

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    label: "Teacher",
    email: "teacher@cubicle.edu",
    password: "teacher123",
    name: "Sarah Chen",
    role: "teacher",
  },
  {
    label: "Admin",
    email: "admin@cubicle.edu",
    password: "admin123",
    name: "James Wilson",
    role: "admin",
  },
];

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
    email: account.email,
    name: account.name,
    role: account.role,
  };
}

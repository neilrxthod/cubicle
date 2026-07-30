import type { DemoAccount, SessionUser } from "./types";

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    label: "Teacher",
    email: "teacher@cubicle.edu",
    password: "teacher123",
    name: "Sarah Chen",
    role: "teacher",
    id: "teacher-1",
    title: "Science teacher",
    department: "Science",
    employmentType: "permanent",
  },
  {
    label: "Admin",
    email: "admin@cubicle.edu",
    password: "admin123",
    name: "James Wilson",
    role: "admin",
    id: "admin-1",
    title: "IT coordinator",
    department: "Technology",
    employmentType: "permanent",
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
    id: account.id,
    email: account.email,
    name: account.name,
    role: account.role,
    title: account.title,
    department: account.department,
    employmentType: account.employmentType,
  };
}

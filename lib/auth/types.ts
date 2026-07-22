export type UserRole = "teacher" | "admin";

export type SessionUser = {
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  title?: string;
  department?: string;
  phone?: string;
  bio?: string;
  notifyEmail?: boolean;
  notifyIssues?: boolean;
};

export type DemoAccount = SessionUser & {
  password: string;
  label: string;
};

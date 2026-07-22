export type UserRole = "teacher" | "admin";

export type SessionUser = {
  /** Supabase auth user id when signed in with Google. */
  id?: string;
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

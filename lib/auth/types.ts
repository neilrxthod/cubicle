export type UserRole = "teacher" | "admin";

export type EmploymentType = "permanent" | "substitute" | "temporary";

export type SessionUser = {
  /** Supabase auth user id when signed in with Google. */
  id?: string;
  email: string;
  /** Display name — typically "First Last" from Google Workspace. */
  name: string;
  /** Google given_name when available. */
  firstName?: string;
  /** Google family_name when available. */
  lastName?: string;
  role: UserRole;
  avatarUrl?: string;
  title?: string;
  department?: string;
  phone?: string;
  bio?: string;
  notifyEmail?: boolean;
  notifyIssues?: boolean;
  /** permanent = blue verified tick */
  employmentType?: EmploymentType;
};

export type DemoAccount = SessionUser & {
  password: string;
  label: string;
};

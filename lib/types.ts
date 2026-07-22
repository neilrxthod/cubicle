export type Role = "teacher" | "admin";

/**
 * School employment category.
 * Only permanent staff receive the blue verification tick.
 */
export type EmploymentType = "permanent" | "substitute" | "temporary";

export type Period = "P1" | "P2" | "P3" | "P4" | "P5";

export type CartStatus = "active" | "maintenance";

export type IssueSeverity = "low" | "medium" | "high";

export type IssueStatus = "open" | "resolved";

export type RestrictionCategory = "ap_exam" | "general" | "other";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** Profile photo as data URL (demo localStorage). */
  avatarUrl?: string;
  title?: string;
  department?: string;
  phone?: string;
  bio?: string;
  notifyEmail?: boolean;
  notifyIssues?: boolean;
  /** permanent | substitute | temporary — permanent = blue tick */
  employmentType?: EmploymentType;
};

export type User = SessionUser & {
  /** Demo / local password only — empty when staff use Google sign-in. */
  password: string;
  /**
   * Whether this email is currently on the school allowlist.
   * false = access revoked (profile may remain for booking history).
   * undefined = local demo (treat as allowed).
   */
  allowlisted?: boolean;
  /** Allowlisted but has not signed in with Google yet. */
  pendingInvite?: boolean;
  /** Profile row timestamps (when known). */
  createdAt?: string;
  updatedAt?: string;
};

export type ProfileUpdate = {
  name: string;
  title?: string;
  department?: string;
  phone?: string;
  bio?: string;
  avatarUrl?: string | null;
  notifyEmail?: boolean;
  notifyIssues?: boolean;
};

export type Cart = {
  id: string;
  name: string;
  status: CartStatus;
  laptopCount?: number;
  location?: string;
};

export type Booking = {
  id: string;
  cartId: string;
  date: string;
  period: Period;
  teacherId: string;
  teacherName: string;
  className?: string;
  subject?: string;
  notes?: string;
  createdAt: string;
};

export type Issue = {
  id: string;
  cartId: string;
  description: string;
  severity: IssueSeverity;
  status: IssueStatus;
  reportedById: string;
  reporterName: string;
  createdAt: string;
};

export type SlotRestriction = {
  id: string;
  cartId: string;
  date: string;
  period: Period;
  category: RestrictionCategory;
  reason?: string;
};

export type BookingPolicy = {
  maxAdvanceDays: number;
};

export type SwapRequest = {
  id: string;
  bookingId: string;
  requesterId: string;
  requesterName: string;
  reason?: string;
  message?: string;
  status: "pending" | "accepted" | "declined";
  createdAt: string;
};

export type PlatformState = {
  carts: Cart[];
  bookings: Booking[];
  issues: Issue[];
  users: User[];
  slotRestrictions: SlotRestriction[];
  bookingPolicy: BookingPolicy;
  swapRequests: SwapRequest[];
};

export const PERIODS: Period[] = ["P1", "P2", "P3", "P4", "P5"];

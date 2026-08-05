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
  /** Google given_name when available. */
  firstName?: string;
  /** Google family_name when available. */
  lastName?: string;
  email: string;
  role: Role;
  /** Profile photo as data URL (demo localStorage) or OAuth URL. */
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
  /**
   * Who last created or changed this slot (teacher booker or admin editor).
   * Shown to all roles so multi-admin edits are visible on the board.
   */
  lastEditedById?: string;
  lastEditedByName?: string;
  lastEditedByAvatarUrl?: string;
  lastEditedAt?: string;
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
  /** How many calendar days ahead teachers may book (from today). */
  maxAdvanceDays: number;
  /**
   * Max cart periods a teacher may hold on a single school day.
   * Admin-configurable up to MAX_SLOTS_PER_TEACHER_PER_DAY.
   * Admins themselves are not limited by this.
   */
  maxSlotsPerTeacherPerDay: number;
};

/** Default max advance booking window (days). */
export const DEFAULT_MAX_ADVANCE_DAYS = 14;

/** Default daily cart-slot cap for teachers. */
export const DEFAULT_MAX_SLOTS_PER_TEACHER_PER_DAY = 5;

/** Upper bound for admin-configured daily cart-slot cap. */
export const MAX_SLOTS_PER_TEACHER_PER_DAY = 15;

export type SwapRequest = {
  id: string;
  bookingId: string;
  /**
   * Requester's booking they are offering in a two-way exchange.
   * Absent / null → one-way handoff (no cart offered).
   */
  offeredBookingId?: string;
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

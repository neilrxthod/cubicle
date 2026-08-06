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
   * Accepted co-teacher on this cart. Board shows both profile photos.
   * Only set after the invitee accepts the share request.
   */
  sharedWithId?: string;
  sharedWithName?: string;
  sharedWithAvatarUrl?: string;
  /**
   * Pending share invite (friend request). Not active until accepted.
   * Invitee sees a request icon on the board slot.
   */
  sharePendingId?: string;
  sharePendingName?: string;
  sharePendingAvatarUrl?: string;
  /**
   * Invitee declined a share invite — shown to the booking owner until dismissed.
   */
  shareDeclinedById?: string;
  shareDeclinedByName?: string;
  shareDeclinedByAvatarUrl?: string;
  shareDeclinedAt?: string;
  /**
   * Who last created or changed this slot (teacher booker or admin editor).
   * Shown to all roles so multi-admin edits are visible on the board.
   */
  lastEditedById?: string;
  lastEditedByName?: string;
  lastEditedByAvatarUrl?: string;
  lastEditedAt?: string;
};

/** True when user owns or co-shares the booking (accepted share only). */
export function bookingInvolvesUser(
  booking: Pick<Booking, "teacherId" | "sharedWithId">,
  userId: string | undefined | null,
): boolean {
  if (!userId) return false;
  return booking.teacherId === userId || booking.sharedWithId === userId;
}

/** True when user has a pending share invite on this booking. */
export function bookingHasShareInviteFor(
  booking: Pick<Booking, "sharePendingId">,
  userId: string | undefined | null,
): boolean {
  return Boolean(userId && booking.sharePendingId === userId);
}

/**
 * Occupancy for period/day caps: owner, accepted share, or pending invite
 * (pending reserves the period so accept cannot double-book).
 */
export function bookingOccupiesUser(
  booking: Pick<Booking, "teacherId" | "sharedWithId" | "sharePendingId">,
  userId: string | undefined | null,
): boolean {
  if (!userId) return false;
  return (
    booking.teacherId === userId ||
    booking.sharedWithId === userId ||
    booking.sharePendingId === userId
  );
}

/**
 * Why the cart is booked — shown as a small tag on the board.
 * Stored in className/subject for display + detection (no extra DB column).
 */
export type BookingPurposeId =
  | "class"
  | "spare"
  | "club"
  | "extra"
  | "ap_exam"
  | "other";

export type BookingPurposeOption = {
  id: BookingPurposeId;
  /** Full label stored on the booking */
  label: string;
  /** Short board badge (omit for Class — default teaching, less noise) */
  tag: string | null;
  /** Badge styles (light cells / dark “mine” cells) */
  tagClass: string;
  tagClassOnDark: string;
};

export const BOOKING_PURPOSES: readonly BookingPurposeOption[] = [
  {
    id: "class",
    label: "Class",
    tag: null,
    tagClass: "",
    tagClassOnDark: "",
  },
  {
    id: "spare",
    label: "Spare",
    tag: "Spare",
    tagClass: "bg-sky-600 text-white",
    tagClassOnDark: "bg-sky-400/25 text-sky-100",
  },
  {
    id: "club",
    label: "Club",
    tag: "Club",
    tagClass: "bg-emerald-600 text-white",
    tagClassOnDark: "bg-emerald-400/25 text-emerald-100",
  },
  {
    id: "extra",
    label: "Extra",
    tag: "Extra",
    tagClass: "bg-amber-600 text-white",
    tagClassOnDark: "bg-amber-400/25 text-amber-100",
  },
  {
    id: "ap_exam",
    label: "AP exam",
    tag: "AP",
    tagClass: "bg-violet-600 text-white",
    tagClassOnDark: "bg-violet-400/25 text-violet-100",
  },
  {
    id: "other",
    label: "Other",
    tag: "Other",
    tagClass: "bg-neutral-600 text-white",
    tagClassOnDark: "bg-white/15 text-white",
  },
] as const;

/** @deprecated use BOOKING_PURPOSES / getBookingPurpose */
export const AP_EXAM_BOOKING_LABEL = "AP exam";

export function getBookingPurposeOption(
  id: BookingPurposeId,
): BookingPurposeOption {
  return (
    BOOKING_PURPOSES.find((p) => p.id === id) ?? BOOKING_PURPOSES[0]!
  );
}

/**
 * Resolve purpose from stored booking fields.
 * Exact label match first; otherwise treat non-empty subject as Class.
 */
export function getBookingPurpose(
  booking: Pick<Booking, "className" | "subject" | "notes">,
): BookingPurposeOption | null {
  const fields = [booking.className, booking.subject, booking.notes]
    .map((v) => (v ?? "").trim().toLowerCase())
    .filter(Boolean);

  for (const purpose of BOOKING_PURPOSES) {
    if (purpose.id === "class") continue;
    const label = purpose.label.toLowerCase();
    if (fields.some((f) => f === label || f.startsWith(`${label} ·`))) {
      return purpose;
    }
  }

  // Legacy / free-text AP variants
  if (
    fields.some(
      (v) => v === "ap_exam" || v === "ap exam" || v.startsWith("ap exam"),
    )
  ) {
    return getBookingPurposeOption("ap_exam");
  }

  if (fields.length > 0) {
    return getBookingPurposeOption("class");
  }
  return null;
}

/** True when this booking was tagged as an AP exam reservation. */
export function isApExamBooking(
  booking: Pick<Booking, "className" | "subject" | "notes">,
): boolean {
  return getBookingPurpose(booking)?.id === "ap_exam";
}

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

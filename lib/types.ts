export type Role = "teacher" | "admin";

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
};

export type User = SessionUser & {
  password: string;
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

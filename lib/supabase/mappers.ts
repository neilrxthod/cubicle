import type {
  Booking,
  BookingPolicy,
  Cart,
  EmploymentType,
  Issue,
  Period,
  PlatformState,
  Role,
  SlotRestriction,
  SwapRequest,
  User,
} from "@/lib/types";

export type DbCart = {
  id: string;
  name: string;
  status: string;
  laptop_count: number | null;
  location: string | null;
};

export type DbBooking = {
  id: string;
  cart_id: string;
  date: string;
  period: string;
  teacher_id: string;
  teacher_name: string;
  class_name: string | null;
  subject: string | null;
  notes: string | null;
  created_at: string;
};

export type DbIssue = {
  id: string;
  cart_id: string;
  description: string;
  severity: string;
  status: string;
  reported_by_id: string;
  reporter_name: string;
  created_at: string;
};

export type DbSlotRestriction = {
  id: string;
  cart_id: string;
  date: string;
  period: string;
  category: string;
  reason: string | null;
};

export type DbSwapRequest = {
  id: string;
  booking_id: string;
  requester_id: string;
  requester_name: string;
  reason: string | null;
  message: string | null;
  status: string;
  created_at: string;
};

export type DbProfile = {
  id: string;
  email: string;
  name: string;
  role: string;
  title: string | null;
  department: string | null;
  phone: string | null;
  bio: string | null;
  avatar_url: string | null;
  notify_email: boolean;
  notify_issues: boolean;
  employment_type?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type DbBookingPolicy = {
  id: number;
  max_advance_days: number;
};

export type DbAllowedEmail = {
  email: string;
  role: string;
  name: string | null;
  employment_type?: string | null;
  created_at?: string | null;
};

function mapEmploymentType(value: string | null | undefined): EmploymentType {
  if (value === "substitute" || value === "temporary" || value === "permanent") {
    return value;
  }
  return "permanent";
}

export function mapCart(row: DbCart): Cart {
  return {
    id: row.id,
    name: row.name,
    status: row.status as Cart["status"],
    laptopCount: row.laptop_count ?? undefined,
    location: row.location ?? undefined,
  };
}

export function mapBooking(row: DbBooking): Booking {
  return {
    id: row.id,
    cartId: row.cart_id,
    date: row.date,
    period: row.period as Period,
    teacherId: row.teacher_id,
    teacherName: row.teacher_name,
    className: row.class_name ?? undefined,
    subject: row.subject ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  };
}

export function mapIssue(row: DbIssue): Issue {
  return {
    id: row.id,
    cartId: row.cart_id,
    description: row.description,
    severity: row.severity as Issue["severity"],
    status: row.status as Issue["status"],
    reportedById: row.reported_by_id,
    reporterName: row.reporter_name,
    createdAt: row.created_at,
  };
}

export function mapSlotRestriction(row: DbSlotRestriction): SlotRestriction {
  return {
    id: row.id,
    cartId: row.cart_id,
    date: row.date,
    period: row.period as Period,
    category: row.category as SlotRestriction["category"],
    reason: row.reason ?? undefined,
  };
}

export function mapSwapRequest(row: DbSwapRequest): SwapRequest {
  return {
    id: row.id,
    bookingId: row.booking_id,
    requesterId: row.requester_id,
    requesterName: row.requester_name,
    reason: row.reason ?? undefined,
    message: row.message ?? undefined,
    status: row.status as SwapRequest["status"],
    createdAt: row.created_at,
  };
}

export function mapProfile(row: DbProfile): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as Role,
    password: "",
    title: row.title ?? undefined,
    department: row.department ?? undefined,
    phone: row.phone ?? undefined,
    bio: row.bio ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    notifyEmail: row.notify_email,
    notifyIssues: row.notify_issues,
    employmentType: mapEmploymentType(row.employment_type),
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

export { mapEmploymentType };

export function mapBookingPolicy(row: DbBookingPolicy | null): BookingPolicy {
  return {
    maxAdvanceDays: row?.max_advance_days ?? 14,
  };
}

export function emptyPlatformState(): PlatformState {
  return {
    carts: [],
    bookings: [],
    issues: [],
    users: [],
    slotRestrictions: [],
    bookingPolicy: { maxAdvanceDays: 14 },
    swapRequests: [],
  };
}

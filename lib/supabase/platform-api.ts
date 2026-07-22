import { createClient } from "@/lib/supabase/client";
import {
  mapBooking,
  mapBookingPolicy,
  mapCart,
  mapEmploymentType,
  mapIssue,
  mapProfile,
  mapSlotRestriction,
  mapSwapRequest,
  type DbAllowedEmail,
  type DbBooking,
  type DbBookingPolicy,
  type DbCart,
  type DbIssue,
  type DbProfile,
  type DbSlotRestriction,
  type DbSwapRequest,
} from "@/lib/supabase/mappers";
import type {
  CartStatus,
  EmploymentType,
  Issue,
  Period,
  PlatformState,
  ProfileUpdate,
  RestrictionCategory,
  Role,
  SessionUser,
  SwapRequest,
  User,
} from "@/lib/types";

function client() {
  return createClient();
}

/** Load full platform state from Supabase (browser client + RLS). */
export async function fetchPlatformState(): Promise<PlatformState> {
  const supabase = client();

  const [
    cartsRes,
    bookingsRes,
    issuesRes,
    restrictionsRes,
    swapsRes,
    policyRes,
    profilesRes,
    allowlistRes,
  ] = await Promise.all([
    supabase.from("carts").select("*").order("name"),
    supabase.from("bookings").select("*").order("created_at", { ascending: false }),
    supabase.from("issues").select("*").order("created_at", { ascending: false }),
    supabase.from("slot_restrictions").select("*"),
    supabase.from("swap_requests").select("*").order("created_at", { ascending: false }),
    supabase.from("booking_policy").select("*").eq("id", 1).maybeSingle(),
    supabase.from("profiles").select("*").order("name"),
    // Admins only (RLS) — teachers get an empty list without failing the load.
    supabase
      .from("allowed_emails")
      .select("email, role, name, employment_type, created_at"),
  ]);

  const firstError =
    cartsRes.error ||
    bookingsRes.error ||
    issuesRes.error ||
    restrictionsRes.error ||
    swapsRes.error ||
    policyRes.error ||
    profilesRes.error;

  if (firstError) {
    throw new Error(firstError.message);
  }

  const profiles = (profilesRes.data as DbProfile[] | null) ?? [];
  const allowlist = allowlistRes.error
    ? []
    : ((allowlistRes.data as DbAllowedEmail[] | null) ?? []);
  const allowlistByEmail = new Map(
    allowlist.map((row) => [row.email.toLowerCase(), row] as const),
  );
  const profileEmails = new Set(profiles.map((p) => p.email.toLowerCase()));

  // Profiles keep history/names; allowlist is source of access + employment type.
  const profileUsers: User[] = profiles.map((row) => {
    const mapped = mapProfile(row);
    const allowed = allowlistByEmail.get(mapped.email.toLowerCase());
    return {
      ...mapped,
      // Prefer allowlist role/name/employment when present (source of access truth).
      role: (allowed?.role as Role | undefined) ?? mapped.role,
      name: allowed?.name?.trim() || mapped.name,
      employmentType: allowed
        ? mapEmploymentType(allowed.employment_type)
        : mapped.employmentType ?? "permanent",
      allowlisted: Boolean(allowed),
      pendingInvite: false,
      password: "",
    };
  });

  // Allowlisted people who have not signed in yet (admin staff list).
  const pendingUsers: User[] = allowlist
    .filter((row) => !profileEmails.has(row.email.toLowerCase()))
    .map((row) => ({
      id: `pending:${row.email.toLowerCase()}`,
      email: row.email,
      name: row.name || row.email.split("@")[0],
      role: row.role as Role,
      password: "",
      employmentType: mapEmploymentType(row.employment_type),
      allowlisted: true,
      pendingInvite: true,
      createdAt: row.created_at ?? undefined,
    }));

  return {
    carts: ((cartsRes.data as DbCart[] | null) ?? []).map(mapCart),
    bookings: ((bookingsRes.data as DbBooking[] | null) ?? []).map(mapBooking),
    issues: ((issuesRes.data as DbIssue[] | null) ?? []).map(mapIssue),
    users: [...profileUsers, ...pendingUsers],
    slotRestrictions: (
      (restrictionsRes.data as DbSlotRestriction[] | null) ?? []
    ).map(mapSlotRestriction),
    bookingPolicy: mapBookingPolicy(
      (policyRes.data as DbBookingPolicy | null) ?? null,
    ),
    swapRequests: ((swapsRes.data as DbSwapRequest[] | null) ?? []).map(
      mapSwapRequest,
    ),
  };
}

/** Map Postgres/Supabase errors to teacher-friendly messages. */
function mapBookingDbError(message: string | undefined): string | undefined {
  if (!message) return undefined;
  const lower = message.toLowerCase();
  // unique (cart_id, date, period) — race: two teachers book same slot
  if (
    lower.includes("duplicate key") ||
    lower.includes("unique constraint") ||
    lower.includes("bookings_cart_id_date_period") ||
    (lower.includes("unique") && lower.includes("violat"))
  ) {
    return "That cart was just booked for this period. Pick another slot.";
  }
  return message;
}

export async function dbCreateBooking(input: {
  cartId: string;
  date: string;
  period: Period;
  teacherId: string;
  teacherName: string;
  className?: string;
  subject?: string;
  notes?: string;
}): Promise<{ id?: string; error?: string }> {
  const supabase = client();
  const { data, error } = await supabase
    .from("bookings")
    .insert({
      cart_id: input.cartId,
      date: input.date,
      period: input.period,
      teacher_id: input.teacherId,
      teacher_name: input.teacherName,
      class_name: input.className ?? null,
      subject: input.subject ?? null,
      notes: input.notes ?? null,
    })
    .select("id")
    .single();
  return {
    id: data?.id ? String(data.id) : undefined,
    error: mapBookingDbError(error?.message),
  };
}

export async function dbDeleteBooking(bookingId: string): Promise<{ error?: string }> {
  const supabase = client();
  const { error } = await supabase.from("bookings").delete().eq("id", bookingId);
  return { error: error?.message };
}

export async function dbDeleteBookings(bookingIds: string[]): Promise<{ error?: string }> {
  const supabase = client();
  const { error } = await supabase.from("bookings").delete().in("id", bookingIds);
  return { error: error?.message };
}

export async function dbReassignBooking(
  bookingId: string,
  cartId: string,
): Promise<{ error?: string }> {
  const supabase = client();
  const { error } = await supabase
    .from("bookings")
    .update({ cart_id: cartId })
    .eq("id", bookingId);
  return { error: mapBookingDbError(error?.message) };
}

export async function dbReportIssue(input: {
  cartId: string;
  description: string;
  severity: Issue["severity"];
  reportedById: string;
  reporterName: string;
}): Promise<{ error?: string }> {
  const supabase = client();
  // High-severity → cart maintenance is handled by a DB trigger (security definer)
  // so teachers do not need cart UPDATE permission.
  const { error } = await supabase.from("issues").insert({
    cart_id: input.cartId,
    description: input.description,
    severity: input.severity,
    status: "open",
    reported_by_id: input.reportedById,
    reporter_name: input.reporterName,
  });
  return { error: error?.message };
}

export async function dbUpdateIssueStatus(
  issueId: string,
  status: Issue["status"],
): Promise<{ error?: string }> {
  const supabase = client();
  const { error } = await supabase
    .from("issues")
    .update({ status })
    .eq("id", issueId);
  return { error: error?.message };
}

export async function dbSetCartStatus(
  cartId: string,
  status: CartStatus,
): Promise<{ error?: string }> {
  const supabase = client();
  const { error } = await supabase
    .from("carts")
    .update({ status })
    .eq("id", cartId);
  return { error: error?.message };
}

export async function dbRequestSwap(input: {
  bookingId: string;
  requesterId: string;
  requesterName: string;
  reason?: string;
}): Promise<{ error?: string }> {
  const supabase = client();
  const { error } = await supabase.from("swap_requests").insert({
    booking_id: input.bookingId,
    requester_id: input.requesterId,
    requester_name: input.requesterName,
    reason: input.reason ?? null,
    message: input.reason ?? null,
    status: "pending",
  });
  return { error: error?.message };
}

export async function dbAcceptSwap(
  request: SwapRequest,
): Promise<{ error?: string }> {
  const supabase = client();
  const { error: bookingError } = await supabase
    .from("bookings")
    .update({
      teacher_id: request.requesterId,
      teacher_name: request.requesterName,
    })
    .eq("id", request.bookingId);
  if (bookingError) return { error: bookingError.message };

  const { error } = await supabase
    .from("swap_requests")
    .update({ status: "accepted" })
    .eq("id", request.id);
  return { error: error?.message };
}

export async function dbDeclineSwap(requestId: string): Promise<{ error?: string }> {
  const supabase = client();
  const { error } = await supabase
    .from("swap_requests")
    .update({ status: "declined" })
    .eq("id", requestId);
  return { error: error?.message };
}

export async function dbInsertRestriction(input: {
  cartId: string;
  date: string;
  period: Period;
  category: RestrictionCategory;
  reason?: string;
}): Promise<{ error?: string }> {
  const supabase = client();
  const { error } = await supabase.from("slot_restrictions").insert({
    cart_id: input.cartId,
    date: input.date,
    period: input.period,
    category: input.category,
    reason: input.reason ?? null,
  });
  return { error: error?.message };
}

export async function dbDeleteRestriction(
  cartId: string,
  date: string,
  period: Period,
): Promise<{ error?: string }> {
  const supabase = client();
  const { error } = await supabase
    .from("slot_restrictions")
    .delete()
    .eq("cart_id", cartId)
    .eq("date", date)
    .eq("period", period);
  return { error: error?.message };
}

export async function dbUpsertRestrictions(
  rows: Array<{
    cartId: string;
    date: string;
    period: Period;
    category: RestrictionCategory;
    reason?: string;
  }>,
): Promise<{ error?: string }> {
  if (rows.length === 0) return {};
  const supabase = client();
  const { error } = await supabase.from("slot_restrictions").upsert(
    rows.map((row) => ({
      cart_id: row.cartId,
      date: row.date,
      period: row.period,
      category: row.category,
      reason: row.reason ?? null,
    })),
    { onConflict: "cart_id,date,period", ignoreDuplicates: true },
  );
  return { error: error?.message };
}

export async function dbDeleteRestrictionsMatching(
  cartIds: string[],
  dates: string[],
  periods: Period[],
): Promise<{ error?: string }> {
  const supabase = client();
  const { error } = await supabase
    .from("slot_restrictions")
    .delete()
    .in("cart_id", cartIds)
    .in("date", dates)
    .in("period", periods);
  return { error: error?.message };
}

export async function dbUpdateBookingPolicy(
  maxAdvanceDays: number,
): Promise<{ error?: string }> {
  const supabase = client();
  const { error } = await supabase
    .from("booking_policy")
    .update({ max_advance_days: maxAdvanceDays })
    .eq("id", 1);
  return { error: error?.message };
}

export async function dbUpdateProfile(
  userId: string,
  input: ProfileUpdate,
): Promise<{ error?: string; data?: SessionUser }> {
  const supabase = client();
  const payload: Record<string, unknown> = {
    name: input.name.trim(),
    title: input.title?.trim() || null,
    department: input.department?.trim() || null,
    phone: input.phone?.trim() || null,
    bio: input.bio?.trim() || null,
    notify_email: input.notifyEmail ?? true,
    notify_issues: input.notifyIssues ?? true,
    updated_at: new Date().toISOString(),
  };

  if (input.avatarUrl === null) {
    payload.avatar_url = null;
  } else if (typeof input.avatarUrl === "string") {
    payload.avatar_url = input.avatarUrl;
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", userId)
    .select("*")
    .single();

  if (error) return { error: error.message };
  const row = data as DbProfile;
  return {
    data: {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role as Role,
      avatarUrl: row.avatar_url ?? undefined,
      title: row.title ?? undefined,
      department: row.department ?? undefined,
      phone: row.phone ?? undefined,
      bio: row.bio ?? undefined,
      notifyEmail: row.notify_email,
      notifyIssues: row.notify_issues,
    },
  };
}

export async function dbAddAllowedEmail(input: {
  email: string;
  name: string;
  role?: Role;
  employmentType?: EmploymentType;
}): Promise<{ error?: string }> {
  const { schoolEmailError } = await import("@/lib/auth/school-domain");
  const domainError = schoolEmailError(input.email);
  if (domainError) return { error: domainError };

  const supabase = client();
  const { error } = await supabase.from("allowed_emails").insert({
    email: input.email.toLowerCase().trim(),
    name: input.name,
    role: input.role ?? "teacher",
    employment_type: input.employmentType ?? "permanent",
  });
  return { error: error?.message };
}

export async function dbUpdateAllowedEmail(
  email: string,
  input: {
    name?: string;
    email?: string;
    role?: Role;
    employmentType?: EmploymentType;
  },
): Promise<{ error?: string }> {
  if (input.email) {
    const { schoolEmailError } = await import("@/lib/auth/school-domain");
    const domainError = schoolEmailError(input.email);
    if (domainError) return { error: domainError };
  }

  const supabase = client();
  const payload: Record<string, unknown> = {};
  if (input.name) payload.name = input.name;
  if (input.role) payload.role = input.role;
  if (input.email) payload.email = input.email.toLowerCase().trim();
  if (input.employmentType) payload.employment_type = input.employmentType;

  const { error } = await supabase
    .from("allowed_emails")
    .update(payload)
    .eq("email", email.toLowerCase().trim());
  return { error: error?.message };
}

/** Best-effort sync of employment type onto signed-in profile rows. */
export async function dbUpdateProfileEmployment(
  userId: string,
  employmentType: EmploymentType,
): Promise<void> {
  const supabase = client();
  await supabase
    .from("profiles")
    .update({
      employment_type: employmentType,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
}

export async function dbDeleteAllowedEmail(email: string): Promise<{ error?: string }> {
  const supabase = client();
  const { error } = await supabase
    .from("allowed_emails")
    .delete()
    .eq("email", email.toLowerCase().trim());
  return { error: error?.message };
}

export async function dbSyncBookingTeacherName(
  teacherId: string,
  name: string,
): Promise<void> {
  const supabase = client();
  await supabase
    .from("bookings")
    .update({ teacher_name: name })
    .eq("teacher_id", teacherId);
  await supabase
    .from("issues")
    .update({ reporter_name: name })
    .eq("reported_by_id", teacherId);
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export type { PlatformState };

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

/**
 * Load allowlist rows for the staff directory.
 * Falls back if employment_type is not migrated yet.
 * Returns { rows, known }: known=false when the query failed (do NOT treat everyone as revoked).
 */
async function fetchAllowlistRows(supabase: ReturnType<typeof client>): Promise<{
  rows: DbAllowedEmail[];
  known: boolean;
}> {
  const full = await supabase
    .from("allowed_emails")
    .select("email, role, name, employment_type, created_at")
    .order("name");

  if (!full.error) {
    return {
      rows: (full.data as DbAllowedEmail[] | null) ?? [],
      known: true,
    };
  }

  const msg = full.error.message.toLowerCase();
  // Pre-migration schemas omit employment_type — retry without it.
  if (msg.includes("employment_type")) {
    const legacy = await supabase
      .from("allowed_emails")
      .select("email, role, name, created_at")
      .order("name");
    if (!legacy.error) {
      return {
        rows: ((legacy.data as DbAllowedEmail[] | null) ?? []).map((row) => ({
          ...row,
          employment_type: "permanent",
        })),
        known: true,
      };
    }
    console.error("[platform] allowlist legacy load failed:", legacy.error.message);
    return { rows: [], known: false };
  }

  // Teachers hit RLS (empty or error). Admins should not silently get "everyone revoked".
  console.error("[platform] allowlist load failed:", full.error.message);
  return { rows: [], known: false };
}

function isMissingMaxSlotsColumnError(message: string | undefined): boolean {
  const msg = (message ?? "").toLowerCase();
  return (
    msg.includes("max_slots_per_teacher_per_day") &&
    (msg.includes("schema cache") ||
      msg.includes("could not find") ||
      msg.includes("does not exist") ||
      msg.includes("column"))
  );
}

/** Load booking_policy; tolerate pre-migration DBs without max_slots column. */
async function fetchBookingPolicyRow(
  supabase: ReturnType<typeof client>,
): Promise<{ data: DbBookingPolicy | null; error?: string }> {
  const full = await supabase
    .from("booking_policy")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (!full.error) {
    return { data: (full.data as DbBookingPolicy | null) ?? null };
  }

  // Explicit column list can fail if PostgREST schema is mid-migration; retry lean.
  if (isMissingMaxSlotsColumnError(full.error.message)) {
    const legacy = await supabase
      .from("booking_policy")
      .select("id, max_advance_days")
      .eq("id", 1)
      .maybeSingle();
    if (!legacy.error) {
      return {
        data: {
          id: 1,
          max_advance_days:
            (legacy.data as { max_advance_days?: number } | null)
              ?.max_advance_days ?? 14,
          max_slots_per_teacher_per_day: 5,
        },
      };
    }
    console.error(
      "[platform] booking_policy legacy load failed:",
      legacy.error.message,
    );
    return { data: null, error: legacy.error.message };
  }

  return { data: null, error: full.error.message };
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
    profilesRes,
  ] = await Promise.all([
    supabase.from("carts").select("*").order("name"),
    supabase.from("bookings").select("*").order("created_at", { ascending: false }),
    supabase.from("issues").select("*").order("created_at", { ascending: false }),
    supabase.from("slot_restrictions").select("*"),
    supabase.from("swap_requests").select("*").order("created_at", { ascending: false }),
    supabase.from("profiles").select("*").order("name"),
  ]);

  const policyLoad = await fetchBookingPolicyRow(supabase);

  const firstError =
    cartsRes.error ||
    bookingsRes.error ||
    issuesRes.error ||
    restrictionsRes.error ||
    swapsRes.error ||
    profilesRes.error ||
    (policyLoad.error ? { message: policyLoad.error } : null);

  if (firstError) {
    throw new Error(firstError.message);
  }

  const { rows: allowlist, known: allowlistKnown } =
    await fetchAllowlistRows(supabase);

  const profiles = (profilesRes.data as DbProfile[] | null) ?? [];
  const allowlistByEmail = new Map(
    allowlist.map((row) => [row.email.toLowerCase().trim(), row] as const),
  );
  const profileEmails = new Set(
    profiles.map((p) => p.email.toLowerCase().trim()),
  );

  // Profiles keep history/names; allowlist is source of access + employment type.
  // Teachers cannot read allowed_emails (admin-only RLS) — that returns [] without
  // error. Do NOT treat empty allowlist as “everyone revoked” or share UI empties.
  const trustAllowlist = allowlistKnown && allowlist.length > 0;
  const profileUsers: User[] = profiles.map((row) => {
    const mapped = mapProfile(row);
    const emailKey = mapped.email.toLowerCase().trim();
    const allowed = allowlistByEmail.get(emailKey);
    const allowlisted = trustAllowlist ? Boolean(allowed) : undefined;
    return {
      ...mapped,
      // Prefer profile admin over allowlist teacher (don't demote active admins).
      role:
        mapped.role === "admin"
          ? "admin"
          : ((allowed?.role as Role | undefined) ?? mapped.role),
      name: allowed?.name?.trim() || mapped.name,
      employmentType: allowed
        ? mapEmploymentType(allowed.employment_type)
        : mapped.employmentType ?? "permanent",
      allowlisted,
      pendingInvite: false,
      password: "",
    };
  });

  // Allowlisted people who have not signed in yet (admin staff list).
  const pendingUsers: User[] = allowlistKnown
    ? allowlist
        .filter((row) => !profileEmails.has(row.email.toLowerCase().trim()))
        .map((row) => ({
          id: `pending:${row.email.toLowerCase().trim()}`,
          email: row.email,
          name: row.name || row.email.split("@")[0],
          role: row.role as Role,
          password: "",
          employmentType: mapEmploymentType(row.employment_type),
          allowlisted: true,
          pendingInvite: true,
          createdAt: row.created_at ?? undefined,
        }))
    : [];

  return {
    carts: ((cartsRes.data as DbCart[] | null) ?? []).map(mapCart),
    bookings: ((bookingsRes.data as DbBooking[] | null) ?? []).map(mapBooking),
    issues: ((issuesRes.data as DbIssue[] | null) ?? []).map(mapIssue),
    users: [...profileUsers, ...pendingUsers],
    slotRestrictions: (
      (restrictionsRes.data as DbSlotRestriction[] | null) ?? []
    ).map(mapSlotRestriction),
    bookingPolicy: mapBookingPolicy(policyLoad.data),
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
  /** Pending share invite (not accepted yet). */
  sharePendingId?: string;
  sharePendingName?: string;
  sharePendingAvatarUrl?: string;
  lastEditedById?: string;
  lastEditedByName?: string;
  lastEditedByAvatarUrl?: string;
}): Promise<{ id?: string; error?: string }> {
  const supabase = client();
  const editedAt = new Date().toISOString();
  const base = {
    cart_id: input.cartId,
    date: input.date,
    period: input.period,
    teacher_id: input.teacherId,
    teacher_name: input.teacherName,
    class_name: input.className ?? null,
    subject: input.subject ?? null,
    notes: input.notes ?? null,
  };
  const withInvite = {
    ...base,
    // Never auto-accept share — only pending invite on create.
    shared_with_id: null as string | null,
    shared_with_name: null as string | null,
    shared_with_avatar_url: null as string | null,
    share_pending_id: input.sharePendingId ?? null,
    share_pending_name: input.sharePendingName ?? null,
    share_pending_avatar_url: input.sharePendingAvatarUrl ?? null,
  };
  const withEditor = {
    ...withInvite,
    last_edited_by_id: input.lastEditedById ?? null,
    last_edited_by_name: input.lastEditedByName ?? null,
    last_edited_by_avatar_url: input.lastEditedByAvatarUrl ?? null,
    last_edited_at: editedAt,
  };
  let { data, error } = await supabase
    .from("bookings")
    .insert(withEditor)
    .select("id")
    .single();
  let shareSkipped = false;
  const wantsInvite = Boolean(input.sharePendingId);

  if (
    error &&
    /share_pending|shared_with/i.test(error.message ?? "")
  ) {
    const withoutShare = {
      ...base,
      last_edited_by_id: input.lastEditedById ?? null,
      last_edited_by_name: input.lastEditedByName ?? null,
      last_edited_by_avatar_url: input.lastEditedByAvatarUrl ?? null,
      last_edited_at: editedAt,
    };
    const retryShare = await supabase
      .from("bookings")
      .insert(withoutShare)
      .select("id")
      .single();
    data = retryShare.data;
    error = retryShare.error;
    if (!error && wantsInvite) shareSkipped = true;
  }
  if (error && /last_edited/i.test(error.message ?? "")) {
    const retry = await supabase
      .from("bookings")
      .insert(withInvite)
      .select("id")
      .single();
    data = retry.data;
    error = retry.error;
    if (error && /share_pending|shared_with/i.test(error.message ?? "")) {
      const bare = await supabase
        .from("bookings")
        .insert(base)
        .select("id")
        .single();
      data = bare.data;
      error = bare.error;
      if (!error && wantsInvite) shareSkipped = true;
    }
  }

  if (error) {
    return {
      id: data?.id ? String(data.id) : undefined,
      error: mapBookingDbError(error.message),
    };
  }

  if (shareSkipped) {
    return {
      id: data?.id ? String(data.id) : undefined,
      error:
        "Cart booked. To enable share invites, run supabase/booking-share.sql in Supabase SQL Editor.",
    };
  }

  return {
    id: data?.id ? String(data.id) : undefined,
  };
}

/** Accept / decline / clear a pending share invite on a booking. */
export async function dbResolveShareInvite(
  bookingId: string,
  next: {
    sharedWithId?: string | null;
    sharedWithName?: string | null;
    sharedWithAvatarUrl?: string | null;
    clearPending: boolean;
  },
): Promise<{ error?: string }> {
  const supabase = client();
  const payload: Record<string, unknown> = {};
  if (next.clearPending) {
    payload.share_pending_id = null;
    payload.share_pending_name = null;
    payload.share_pending_avatar_url = null;
  }
  if (next.sharedWithId !== undefined) {
    payload.shared_with_id = next.sharedWithId;
    payload.shared_with_name = next.sharedWithName ?? null;
    payload.shared_with_avatar_url = next.sharedWithAvatarUrl ?? null;
  }
  const { error } = await supabase
    .from("bookings")
    .update(payload)
    .eq("id", bookingId);
  return { error: error?.message };
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
  editor?: {
    id: string;
    name: string;
    avatarUrl?: string;
  },
): Promise<{ error?: string }> {
  const supabase = client();
  const payload: Record<string, unknown> = { cart_id: cartId };
  if (editor) {
    payload.last_edited_by_id = editor.id;
    payload.last_edited_by_name = editor.name;
    payload.last_edited_by_avatar_url = editor.avatarUrl ?? null;
    payload.last_edited_at = new Date().toISOString();
  }
  let { error } = await supabase
    .from("bookings")
    .update(payload)
    .eq("id", bookingId);
  if (error && /last_edited/i.test(error.message ?? "")) {
    const retry = await supabase
      .from("bookings")
      .update({ cart_id: cartId })
      .eq("id", bookingId);
    error = retry.error;
  }
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

export async function dbDeleteIssue(
  issueId: string,
): Promise<{ error?: string }> {
  const supabase = client();
  // Return deleted rows so we can detect RLS blocking (0 rows, no error).
  const { data, error } = await supabase
    .from("issues")
    .delete()
    .eq("id", issueId)
    .select("id");

  if (error) return { error: error.message };
  if (!data?.length) {
    return {
      error:
        "Could not delete this issue in Supabase (permission denied or missing delete policy). Run supabase/issues-delete.sql in the Supabase SQL Editor.",
    };
  }
  return {};
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

export async function dbCreateCart(input: {
  id: string;
  name: string;
  location?: string;
  laptopCount?: number;
  status?: CartStatus;
}): Promise<{ error?: string }> {
  const supabase = client();
  const { error } = await supabase.from("carts").insert({
    id: input.id,
    name: input.name,
    status: input.status ?? "active",
    location: input.location ?? null,
    laptop_count: input.laptopCount ?? null,
  });
  return { error: error?.message };
}

export async function dbUpdateCart(
  cartId: string,
  input: {
    name: string;
    location?: string;
    laptopCount?: number;
  },
): Promise<{ error?: string }> {
  const supabase = client();
  const { error } = await supabase
    .from("carts")
    .update({
      name: input.name,
      location: input.location ?? null,
      laptop_count: input.laptopCount ?? null,
    })
    .eq("id", cartId);
  return { error: error?.message };
}

/** Deletes a cart; related bookings/issues/restrictions cascade in Postgres. */
export async function dbDeleteCart(
  cartId: string,
): Promise<{ error?: string }> {
  const supabase = client();
  const { data, error } = await supabase
    .from("carts")
    .delete()
    .eq("id", cartId)
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) {
    return {
      error:
        "Could not delete this cart (permission denied or already removed).",
    };
  }
  return {};
}

/**
 * Wipe school operational tables (carts, bookings, issues, restrictions, swaps).
 * Deleting carts cascades bookings / issues / restrictions; swaps cascade from bookings.
 * Keeps profiles + allowlist. Requires admin RLS policies.
 */
export async function dbWipeOperationalData(): Promise<{ error?: string }> {
  const supabase = client();
  // PostgREST requires a filter — match every cart id.
  const { error } = await supabase.from("carts").delete().neq("id", "");
  if (error) return { error: error.message };
  return {};
}

export async function dbRequestSwap(input: {
  bookingId: string;
  requesterId: string;
  requesterName: string;
  reason?: string;
  offeredBookingId?: string;
}): Promise<{ error?: string }> {
  const supabase = client();
  const base = {
    booking_id: input.bookingId,
    requester_id: input.requesterId,
    requester_name: input.requesterName,
    reason: input.reason ?? null,
    message: input.reason ?? null,
    status: "pending" as const,
  };
  const withOffer = {
    ...base,
    offered_booking_id: input.offeredBookingId ?? null,
  };
  let { error } = await supabase.from("swap_requests").insert(withOffer);
  // Pre-migration DBs may not have offered_booking_id yet.
  if (error && /offered_booking_id/i.test(error.message ?? "")) {
    const retry = await supabase.from("swap_requests").insert(base);
    error = retry.error;
  }
  return { error: error?.message };
}

export type AcceptSwapOptions = {
  /** Requester's booking for the same date/period (true two-way swap). */
  counterpartyBookingId?: string;
  originalOwner: {
    teacherId: string;
    teacherName: string;
    className?: string;
    subject?: string;
    notes?: string;
  };
  requesterSlot?: {
    className?: string;
    subject?: string;
    notes?: string;
  };
  editor?: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
};

/**
 * Accept a swap: exchange both cart slots when the requester also has a booking
 * for the same date/period; otherwise transfer the requested slot one-way.
 *
 * Prefers the security-definer RPC (see supabase/swap-accept.sql) so RLS allows
 * updating the counterparty booking. Falls back to direct updates when the RPC
 * is not yet installed (admins can update both rows under RLS).
 */
export async function dbAcceptSwap(
  request: SwapRequest,
  options: AcceptSwapOptions,
): Promise<{ error?: string }> {
  const supabase = client();
  const editedAt = new Date().toISOString();
  const editor = options.editor;

  // Atomic path: two-way swap + status update under security definer.
  const { error: rpcError } = await supabase.rpc("accept_swap_request", {
    p_request_id: request.id,
    p_editor_id: editor?.id ?? null,
    p_editor_name: editor?.name ?? null,
    p_editor_avatar_url: editor?.avatarUrl ?? null,
  });

  if (!rpcError) return {};

  const rpcMissing =
    /could not find the function|function .* does not exist|PGRST202/i.test(
      rpcError.message ?? "",
    );
  if (!rpcMissing) {
    return { error: rpcError.message };
  }

  // Fallback when swap-accept.sql has not been applied yet.
  const ownerPatch = {
    teacher_id: options.originalOwner.teacherId,
    teacher_name: options.originalOwner.teacherName,
    class_name: options.originalOwner.className ?? null,
    subject: options.originalOwner.subject ?? null,
    notes: options.originalOwner.notes ?? null,
  };
  const requesterPatch = {
    teacher_id: request.requesterId,
    teacher_name: request.requesterName,
    class_name: options.requesterSlot?.className ?? null,
    subject: options.requesterSlot?.subject ?? null,
    notes: options.requesterSlot?.notes ?? null,
  };

  const stamp = editor
    ? {
        last_edited_by_id: editor.id,
        last_edited_by_name: editor.name,
        last_edited_by_avatar_url: editor.avatarUrl ?? null,
        last_edited_at: editedAt,
      }
    : {};

  if (options.counterpartyBookingId) {
    // Target slot ← requester (keeps requester class info).
    let { error: targetError } = await supabase
      .from("bookings")
      .update({ ...requesterPatch, ...stamp })
      .eq("id", request.bookingId);
    if (targetError && /last_edited/i.test(targetError.message ?? "")) {
      const retry = await supabase
        .from("bookings")
        .update(requesterPatch)
        .eq("id", request.bookingId);
      targetError = retry.error;
    }
    if (targetError) return { error: targetError.message };

    // Counterparty slot ← original owner (keeps owner class info).
    let { error: sourceError } = await supabase
      .from("bookings")
      .update({ ...ownerPatch, ...stamp })
      .eq("id", options.counterpartyBookingId);
    if (sourceError && /last_edited/i.test(sourceError.message ?? "")) {
      const retry = await supabase
        .from("bookings")
        .update(ownerPatch)
        .eq("id", options.counterpartyBookingId);
      sourceError = retry.error;
    }
    if (sourceError) {
      // Roll back target so we don't leave a one-sided transfer.
      await supabase
        .from("bookings")
        .update({
          teacher_id: options.originalOwner.teacherId,
          teacher_name: options.originalOwner.teacherName,
          class_name: options.originalOwner.className ?? null,
          subject: options.originalOwner.subject ?? null,
          notes: options.originalOwner.notes ?? null,
        })
        .eq("id", request.bookingId);
      return {
        error:
          sourceError.message ||
          "Could not update the requester's cart. Run supabase/swap-accept.sql in the SQL Editor, then try again.",
      };
    }
  } else {
    // One-way: requester has no cart this period — hand over this slot only.
    const oneWay = {
      teacher_id: request.requesterId,
      teacher_name: request.requesterName,
      ...stamp,
    };
    let { error: bookingError } = await supabase
      .from("bookings")
      .update(oneWay)
      .eq("id", request.bookingId);
    if (bookingError && /last_edited/i.test(bookingError.message ?? "")) {
      const retry = await supabase
        .from("bookings")
        .update({
          teacher_id: request.requesterId,
          teacher_name: request.requesterName,
        })
        .eq("id", request.bookingId);
      bookingError = retry.error;
    }
    if (bookingError) return { error: bookingError.message };
  }

  const { error } = await supabase
    .from("swap_requests")
    .update({ status: "accepted" })
    .eq("id", request.id)
    .eq("status", "pending");
  if (error) return { error: error.message };

  // Close other pendings that targeted either booking (best-effort fallback).
  const relatedIds = [request.bookingId, options.counterpartyBookingId].filter(
    Boolean,
  ) as string[];
  if (relatedIds.length > 0) {
    await supabase
      .from("swap_requests")
      .update({ status: "declined" })
      .eq("status", "pending")
      .neq("id", request.id)
      .in("booking_id", relatedIds);
  }
  return {};
}

export async function dbDeclineSwap(requestId: string): Promise<{ error?: string }> {
  const supabase = client();

  // Prefer security-definer RPC (owner / admin / requester checks server-side).
  const { error: rpcError } = await supabase.rpc("decline_swap_request", {
    p_request_id: requestId,
  });
  if (!rpcError) return {};

  const rpcMissing =
    /could not find the function|function .* does not exist|PGRST202/i.test(
      rpcError.message ?? "",
    );
  if (!rpcMissing) {
    return { error: rpcError.message };
  }

  // Fallback when swap-accept.sql has not been applied yet.
  const { error } = await supabase
    .from("swap_requests")
    .update({ status: "declined" })
    .eq("id", requestId)
    .eq("status", "pending");
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
  // Chunk writes — large day × cart × period batches can fail as one request.
  const payload = rows.map((row) => ({
    cart_id: row.cartId,
    date: row.date,
    period: row.period,
    category: row.category,
    reason: row.reason ?? null,
  }));
  const CHUNK = 80;
  for (let i = 0; i < payload.length; i += CHUNK) {
    const slice = payload.slice(i, i + CHUNK);
    // Prefer plain insert (clearer RLS errors). Fall back to upsert on conflict.
    const insert = await supabase.from("slot_restrictions").insert(slice);
    if (!insert.error) continue;

    const msg = insert.error.message?.toLowerCase() ?? "";
    const isConflict =
      insert.error.code === "23505" ||
      msg.includes("duplicate") ||
      msg.includes("unique");

    if (isConflict) {
      const upsert = await supabase.from("slot_restrictions").upsert(slice, {
        onConflict: "cart_id,date,period",
      });
      if (upsert.error) return { error: upsert.error.message };
      continue;
    }

    return { error: insert.error.message };
  }
  return {};
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

const MAX_SLOTS_MIGRATION_HINT =
  "Run supabase/booking-policy-max-slots.sql in the Supabase SQL Editor (then retry Save).";

/** Update booking purpose / multi-book tag (class_name + subject). */
export async function dbUpdateBookingLabel(
  bookingId: string,
  label: string,
  editor?: { id?: string; name?: string; avatarUrl?: string },
): Promise<{ error?: string }> {
  const supabase = client();
  const editedAt = new Date().toISOString();
  const payload: Record<string, unknown> = {
    class_name: label,
    subject: label,
  };
  if (editor?.id) {
    payload.last_edited_by_id = editor.id;
    payload.last_edited_by_name = editor.name ?? null;
    payload.last_edited_by_avatar_url = editor.avatarUrl ?? null;
    payload.last_edited_at = editedAt;
  }
  const { error } = await supabase
    .from("bookings")
    .update(payload)
    .eq("id", bookingId);
  if (error) {
    // Retry without editor columns if migration missing.
    const msg = error.message.toLowerCase();
    if (msg.includes("last_edited")) {
      const retry = await supabase
        .from("bookings")
        .update({ class_name: label, subject: label })
        .eq("id", bookingId);
      if (retry.error) return { error: retry.error.message };
      return {};
    }
    return { error: error.message };
  }
  return {};
}

export async function dbUpdateBookingPolicy(input: {
  maxAdvanceDays?: number;
  maxSlotsPerTeacherPerDay?: number;
}): Promise<{ error?: string }> {
  const supabase = client();
  const payload: Record<string, number> = {};
  if (typeof input.maxAdvanceDays === "number") {
    payload.max_advance_days = input.maxAdvanceDays;
  }
  if (typeof input.maxSlotsPerTeacherPerDay === "number") {
    payload.max_slots_per_teacher_per_day = input.maxSlotsPerTeacherPerDay;
  }
  if (Object.keys(payload).length === 0) {
    return { error: "Nothing to update." };
  }

  const { error } = await supabase
    .from("booking_policy")
    .update(payload)
    .eq("id", 1);

  if (!error) return {};

  // Pre-migration: column not on booking_policy yet.
  if (
    isMissingMaxSlotsColumnError(error.message) &&
    payload.max_slots_per_teacher_per_day !== undefined
  ) {
    // Still save the booking window if it was part of this write.
    if (typeof payload.max_advance_days === "number") {
      const retry = await supabase
        .from("booking_policy")
        .update({ max_advance_days: payload.max_advance_days })
        .eq("id", 1);
      if (retry.error) return { error: retry.error.message };
      return {
        error:
          "Booking window saved. Max cart slots needs a database column — " +
          MAX_SLOTS_MIGRATION_HINT,
      };
    }
    return {
      error:
        "Max cart slots is not in the database yet. " + MAX_SLOTS_MIGRATION_HINT,
    };
  }

  return { error: error.message };
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

/**
 * Fan-out display name to every denormalized column so boards, issues, swaps,
 * editor labels, and allowlist rows stay consistent after a profile rename.
 */
export async function dbSyncBookingTeacherName(
  teacherId: string,
  name: string,
  options?: { email?: string | null },
): Promise<void> {
  const supabase = client();
  const trimmed = name.trim();
  if (!trimmed) return;

  const email = options?.email?.trim().toLowerCase();

  await Promise.all([
    supabase
      .from("bookings")
      .update({ teacher_name: trimmed })
      .eq("teacher_id", teacherId),
    supabase
      .from("bookings")
      .update({ last_edited_by_name: trimmed })
      .eq("last_edited_by_id", teacherId),
    supabase
      .from("issues")
      .update({ reporter_name: trimmed })
      .eq("reported_by_id", teacherId),
    supabase
      .from("swap_requests")
      .update({ requester_name: trimmed })
      .eq("requester_id", teacherId),
    email
      ? supabase
          .from("allowed_emails")
          .update({ name: trimmed })
          .eq("email", email)
      : Promise.resolve({ error: null }),
  ]);
}

/**
 * Fan-out profile photo to denormalized booking editor columns so faces on
 * the board stay in sync when a user changes or removes their avatar.
 */
export async function dbSyncLastEditorAvatar(
  userId: string,
  avatarUrl: string | null,
): Promise<void> {
  const supabase = client();
  await supabase
    .from("bookings")
    .update({ last_edited_by_avatar_url: avatarUrl })
    .eq("last_edited_by_id", userId);
}

/**
 * Persist Google OAuth first+last (as full name) + avatar onto profiles,
 * then fan-out denormalized names for live boards.
 */
export async function dbSyncOAuthIdentity(
  userId: string,
  input: {
    name: string;
    avatarUrl?: string | null;
    /** When true, always write name. When false, only fill placeholders. */
    forceName?: boolean;
    existingName?: string | null;
    email?: string | null;
  },
): Promise<{ name: string; avatarUrl?: string }> {
  const supabase = client();
  const nextName = input.name.trim().slice(0, 80);
  const force = input.forceName !== false;

  const { isPlaceholderDisplayName } = await import(
    "@/lib/auth/google-identity"
  );
  const shouldWriteName =
    Boolean(nextName) &&
    (force ||
      isPlaceholderDisplayName(input.existingName, input.email) ||
      (input.existingName ?? "").trim() !== nextName);

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (shouldWriteName) {
    payload.name = nextName;
  }

  // Only seed avatar when caller provides one (OAuth path should not force
  // Google over a user-uploaded photo — see syncOAuthProfileFromGoogle).
  if (input.avatarUrl) {
    payload.avatar_url = input.avatarUrl;
  }

  if (Object.keys(payload).length > 1) {
    await supabase.from("profiles").update(payload).eq("id", userId);
  }

  const resolvedName = shouldWriteName
    ? nextName
    : (input.existingName ?? nextName).trim();

  if (resolvedName) {
    await dbSyncBookingTeacherName(userId, resolvedName);
  }

  return {
    name: resolvedName,
    avatarUrl: input.avatarUrl ?? undefined,
  };
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export type { PlatformState };

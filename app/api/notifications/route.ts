import { NextResponse } from "next/server";
import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getEmailDeliveryStatus,
  isBrevoConfigured,
  sendEmail,
} from "@/lib/email/brevo";
import { isLocalDevRuntime } from "@/lib/data/durability";
import {
  localSubject,
  resolveDeliveryPlan,
  type LocalEmailSink,
} from "@/lib/email/delivery";
import {
  buildBookingCancelledEmail,
  buildBookingRelocatedEmail,
  buildDevTestEmail,
  buildIssueReportEmail,
  buildSelfTestEmail,
  buildShareInviteEmail,
  buildSwapExchangeEmail,
  buildSwapHandoffEmail,
  buildSwapInviteEmail,
  buildSwapInviteUpdateEmail,
} from "@/lib/email/templates";
import type { NotificationPayload } from "@/lib/email/queue";

type ProfileMailRow = {
  id: string;
  email: string | null;
  name: string | null;
  role: string | null;
  notify_email: boolean | null;
  notify_issues: boolean | null;
};

type RequestBody = NotificationPayload & {
  localSink?: LocalEmailSink;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PROFILE_MAIL_SELECT =
  "id, email, name, role, notify_email, notify_issues";
const PROFILE_MAIL_SELECT_FALLBACK = "id, email, name, role";

/**
 * Authenticated (production) / local-sink notification dispatch via Brevo.
 *
 * Local: default no-send. Only when Settings testing toggle is on and a sink
 * email is set — and only if the server itself is in local runtime.
 * Production: real recipients; client sink is ignored.
 *
 * Dispatch is awaited here. Booking / issue UI already fires this request in
 * the background (`keepalive` fetch), so waiting on Brevo does not block staff
 * actions — and `after()` was dropping the send when the client aborted.
 */
export async function GET(request: Request) {
  const messageId = new URL(request.url).searchParams.get("messageId")?.trim();
  if (messageId) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: "Sign in required." }, { status: 401 });
      }
    } catch {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }
    const status = await getEmailDeliveryStatus(messageId);
    return NextResponse.json(status);
  }

  return NextResponse.json({
    configured: isBrevoConfigured(),
    mode: isLocalDevRuntime() ? "local" : "production",
    live: isBrevoConfigured() && !isLocalDevRuntime(),
  });
}

export async function POST(request: Request) {
  if (!isBrevoConfigured()) {
    return NextResponse.json(
      { ok: true, skipped: true, reason: "Brevo not configured" },
      { status: 200 },
    );
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || !("type" in body)) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const plan = resolveDeliveryPlan(body.localSink);
  if (plan.mode === "blocked") {
    return NextResponse.json(
      { ok: true, skipped: true, reason: plan.reason, sent: 0 },
      { status: 200 },
    );
  }

  // Production always requires a signed-in user.
  // Local sink: auth optional (demo sandbox may lack Supabase cookies).
  let actorId: string | null = null;
  let actorEmail: string | null = null;
  let actorName: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user: actor },
    } = await supabase.auth.getUser();
    actorId = actor?.id ?? null;
    actorEmail = actor?.email ?? null;
    const metaName = actor?.user_metadata?.full_name ?? actor?.user_metadata?.name;
    actorName = typeof metaName === "string" ? metaName : null;
  } catch {
    // Auth env missing
  }

  if (plan.mode === "production" && !actorId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  if (body.type === "dev_test") {
    if (plan.mode !== "local_sink") {
      return NextResponse.json(
        { error: "Test emails are only available in local development." },
        { status: 403 },
      );
    }
    const result = await sendDevTest(plan.email);
    return NextResponse.json(result);
  }

  const sink =
    plan.mode === "local_sink"
      ? { email: plan.email, name: "Local sink" as const }
      : null;

  // Local sink can render from payload alone (no DB) for most types.
  if (sink) {
    try {
      return NextResponse.json(await dispatchLocalSink(body, sink));
    } catch (err) {
      console.error("[notifications] local sink", err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to send." },
        { status: 500 },
      );
    }
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Server email dispatch is not configured." },
      { status: 503 },
    );
  }

  try {
    const result = await dispatchProduction(admin, actorId!, body, {
      email: actorEmail,
      name: actorName,
    });
    if (!result.ok) {
      console.error("[notifications] dispatch failed", body.type, result);
    } else if ("sent" in result) {
      const sent = result.sent ?? 0;
      if (sent === 0) {
        console.warn("[notifications] dispatch sent 0", body.type, result);
      } else {
        console.info("[notifications] sent", body.type, sent);
      }
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("[notifications]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send." },
      { status: 500 },
    );
  }
}

function formatDateLabel(date: string): string {
  try {
    if (date) return format(parseISO(date), "EEE, MMM d");
  } catch {
    /* keep raw */
  }
  return date;
}

async function dispatchLocalSink(
  body: NotificationPayload,
  sink: { email: string; name: string },
) {
  if (body.type === "issue_reported") {
    return sendIssueEmail({
      recipients: [sink],
      payload: body,
      subjectPrefix: true,
    });
  }
  if (body.type === "share_invite") {
    return sendShareEmail({
      to: sink,
      payload: body,
      subjectPrefix: true,
    });
  }
  if (body.type === "booking_relocated") {
    return sendRelocatedTo([sink], body, true);
  }
  if (body.type === "booking_cancelled") {
    return sendCancelledTo([sink], body, true);
  }
  if (body.type === "swap_exchange") {
    // One combined preview to sink (exchange notifies both parties in prod).
    return sendExchangeTo(sink, body, "A", true);
  }
  if (body.type === "swap_handoff") {
    return sendHandoffTo(sink, body, "admin", true);
  }
  if (body.type === "swap_invite") {
    return sendSwapInviteTo(sink, body, true);
  }
  if (body.type === "swap_invite_update") {
    return sendSwapInviteUpdateTo(sink, body, true);
  }
  if (body.type === "self_test") {
    return sendSelfTestTo(sink, true);
  }
  return { error: "Unknown notification type.", ok: false as const };
}

async function dispatchProduction(
  admin: ReturnType<typeof createAdminClient>,
  actorId: string,
  body: NotificationPayload,
  actor?: { email: string | null; name: string | null },
) {
  if (body.type === "issue_reported") {
    return handleIssueReported(admin, actorId, body);
  }
  if (body.type === "share_invite") {
    return handleShareInvite(admin, actorId, body);
  }
  if (body.type === "booking_relocated") {
    return handleBookingRelocated(admin, body);
  }
  if (body.type === "booking_cancelled") {
    return handleBookingCancelled(admin, body);
  }
  if (body.type === "swap_exchange") {
    return handleSwapExchange(admin, body);
  }
  if (body.type === "swap_handoff") {
    return handleSwapHandoff(admin, body);
  }
  if (body.type === "swap_invite") {
    return handleSwapInvite(admin, body);
  }
  if (body.type === "swap_invite_update") {
    return handleSwapInviteUpdate(admin, body);
  }
  if (body.type === "self_test") {
    return handleSelfTest(admin, actorId, actor);
  }
  return { error: "Unknown notification type.", ok: false as const };
}

function missingNotifyColumnError(
  error: { message?: string; code?: string } | null | undefined,
): boolean {
  if (!error) return false;
  const hay = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
  return (
    hay.includes("notify_email") ||
    hay.includes("notify_issues") ||
    hay.includes("pgrst204") ||
    hay.includes("42703")
  );
}

function toMailRow(data: Record<string, unknown>): ProfileMailRow {
  return {
    id: String(data.id ?? ""),
    email: typeof data.email === "string" ? data.email : null,
    name: typeof data.name === "string" ? data.name : null,
    role: typeof data.role === "string" ? data.role : null,
    notify_email:
      typeof data.notify_email === "boolean" ? data.notify_email : true,
    notify_issues:
      typeof data.notify_issues === "boolean" ? data.notify_issues : true,
  };
}

async function selectMailProfiles(
  admin: ReturnType<typeof createAdminClient>,
  filters: { id?: string; role?: string },
): Promise<ProfileMailRow[]> {
  const run = (columns: string) => {
    let query = admin.from("profiles").select(columns);
    if (filters.id) query = query.eq("id", filters.id);
    if (filters.role) query = query.eq("role", filters.role);
    return query;
  };

  let { data, error } = await run(PROFILE_MAIL_SELECT);
  if (error && missingNotifyColumnError(error)) {
    console.warn(
      "[notifications] notify_* columns missing — run supabase/notify-email.sql",
    );
    ({ data, error } = await run(PROFILE_MAIL_SELECT_FALLBACK));
  }
  if (error) {
    console.error("[notifications] load profiles", error.message);
    return [];
  }
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(toMailRow);
}

async function emailFromAuthUser(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<string | null> {
  try {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data.user?.email?.includes("@")) return null;
    return data.user.email;
  } catch (err) {
    console.error("[notifications] auth email lookup", err);
    return null;
  }
}

async function loadMailUser(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  opts?: { ignorePref?: boolean },
): Promise<{ email: string; name?: string } | null> {
  const row = (await selectMailProfiles(admin, { id: userId }))[0];
  if (!row) {
    const email = await emailFromAuthUser(admin, userId);
    if (!email) return null;
    return { email };
  }
  if (row.notify_email === false && !opts?.ignorePref) return null;
  let email = row.email;
  if (!email?.includes("@")) {
    email = await emailFromAuthUser(admin, userId);
  }
  if (!email?.includes("@")) return null;
  return { email, name: row.name ?? undefined };
}

async function loadAdminRecipients(
  admin: ReturnType<typeof createAdminClient>,
  excludeIds: string[] = [],
): Promise<Array<{ email: string; name?: string }>> {
  const exclude = new Set(excludeIds);
  const rows = await selectMailProfiles(admin, { role: "admin" });
  return rows
    .filter(
      (row) =>
        !exclude.has(row.id) &&
        row.notify_email !== false &&
        Boolean(row.email?.includes("@")),
    )
    .map((row) => ({
      email: row.email!,
      name: row.name ?? undefined,
    }));
}

async function sendRelocatedTo(
  recipients: Array<{ email: string; name?: string }>,
  payload: Extract<NotificationPayload, { type: "booking_relocated" }>,
  localTesting?: boolean,
) {
  if (recipients.length === 0) return { ok: true as const, sent: 0 };
  const built = buildBookingRelocatedEmail({
    fromCartName: payload.fromCartName,
    toCartName: payload.toCartName,
    dateLabel: formatDateLabel(payload.date),
    period: payload.period,
    reason: payload.reason,
    localTesting,
  });
  const subject = localTesting ? localSubject(built.subject) : built.subject;
  const results = await Promise.all(
    recipients.map((to) =>
      sendEmail({
        to,
        subject,
        html: built.html,
        text: built.text,
        tags: ["booking-relocated", payload.reason, ...(localTesting ? ["local-dev"] : [])],
      }),
    ),
  );
  const sent = results.filter((result) => result.ok && !result.skipped).length;
  return { ok: true as const, sent };
}

async function sendCancelledTo(
  recipients: Array<{ email: string; name?: string }>,
  payload: Extract<NotificationPayload, { type: "booking_cancelled" }>,
  localTesting?: boolean,
) {
  if (recipients.length === 0) return { ok: true as const, sent: 0 };
  const built = buildBookingCancelledEmail({
    cartName: payload.cartName,
    dateLabel: formatDateLabel(payload.date),
    period: payload.period,
    reason: payload.reason,
    localTesting,
  });
  const subject = localTesting ? localSubject(built.subject) : built.subject;
  const results = await Promise.all(
    recipients.map((to) =>
      sendEmail({
        to,
        subject,
        html: built.html,
        text: built.text,
        tags: ["booking-cancelled", payload.reason, ...(localTesting ? ["local-dev"] : [])],
      }),
    ),
  );
  const sent = results.filter((result) => result.ok && !result.skipped).length;
  return { ok: true as const, sent };
}

async function sendExchangeTo(
  to: { email: string; name?: string },
  payload: Extract<NotificationPayload, { type: "swap_exchange" }>,
  side: "A" | "B",
  localTesting?: boolean,
) {
  const built = buildSwapExchangeEmail({
    peerName: side === "A" ? payload.teacherBName : payload.teacherAName,
    yourCartName: side === "A" ? payload.cartAName : payload.cartBName,
    theirCartName: side === "A" ? payload.cartBName : payload.cartAName,
    dateLabel: formatDateLabel(payload.date),
    period: payload.period,
    localTesting,
  });
  const subject = localTesting ? localSubject(built.subject) : built.subject;
  const result = await sendEmail({
    to,
    subject,
    html: built.html,
    text: built.text,
    tags: ["swap-exchange", ...(localTesting ? ["local-dev"] : [])],
  });
  if (!result.ok) return { ok: false as const, error: result.error };
  return { ok: true as const, sent: result.skipped ? 0 : 1 };
}

async function sendHandoffTo(
  to: { email: string; name?: string },
  payload: Extract<NotificationPayload, { type: "swap_handoff" }>,
  role: "receiver" | "owner" | "admin",
  localTesting?: boolean,
) {
  const built = buildSwapHandoffEmail({
    role,
    fromTeacherName: payload.fromTeacherName,
    toTeacherName: payload.toTeacherName,
    cartName: payload.cartName,
    dateLabel: formatDateLabel(payload.date),
    period: payload.period,
    localTesting,
  });
  const subject = localTesting ? localSubject(built.subject) : built.subject;
  const result = await sendEmail({
    to,
    subject,
    html: built.html,
    text: built.text,
    tags: ["swap-handoff", role, ...(localTesting ? ["local-dev"] : [])],
  });
  if (!result.ok) return { ok: false as const, error: result.error };
  return { ok: true as const, sent: result.skipped ? 0 : 1 };
}

async function handleBookingRelocated(
  admin: ReturnType<typeof createAdminClient>,
  payload: Extract<NotificationPayload, { type: "booking_relocated" }>,
) {
  const user = await loadMailUser(admin, payload.teacherId);
  if (!user) return { ok: true as const, sent: 0 };
  return sendRelocatedTo([user], payload, false);
}

async function handleBookingCancelled(
  admin: ReturnType<typeof createAdminClient>,
  payload: Extract<NotificationPayload, { type: "booking_cancelled" }>,
) {
  const user = await loadMailUser(admin, payload.teacherId);
  if (!user) return { ok: true as const, sent: 0 };
  return sendCancelledTo([user], payload, false);
}

async function handleSwapExchange(
  admin: ReturnType<typeof createAdminClient>,
  payload: Extract<NotificationPayload, { type: "swap_exchange" }>,
) {
  const [a, b] = await Promise.all([
    loadMailUser(admin, payload.teacherAId),
    loadMailUser(admin, payload.teacherBId),
  ]);
  const results = await Promise.all([
    a ? sendExchangeTo(a, payload, "A", false) : null,
    b ? sendExchangeTo(b, payload, "B", false) : null,
  ]);
  const sent = results.reduce(
    (sum, result) => sum + (result?.ok ? (result.sent ?? 0) : 0),
    0,
  );
  return { ok: true as const, sent };
}

async function handleSwapHandoff(
  admin: ReturnType<typeof createAdminClient>,
  payload: Extract<NotificationPayload, { type: "swap_handoff" }>,
) {
  const [owner, receiver, admins] = await Promise.all([
    loadMailUser(admin, payload.fromTeacherId),
    loadMailUser(admin, payload.toTeacherId),
    loadAdminRecipients(admin, [
      payload.fromTeacherId,
      payload.toTeacherId,
    ]),
  ]);
  const results = await Promise.all([
    owner ? sendHandoffTo(owner, payload, "owner", false) : null,
    receiver ? sendHandoffTo(receiver, payload, "receiver", false) : null,
    ...admins.map((adminTo) => sendHandoffTo(adminTo, payload, "admin", false)),
  ]);
  const sent = results.reduce(
    (sum, result) => sum + (result?.ok ? (result.sent ?? 0) : 0),
    0,
  );
  return { ok: true as const, sent };
}

async function sendSwapInviteTo(
  to: { email: string; name?: string },
  payload: Extract<NotificationPayload, { type: "swap_invite" }>,
  localTesting?: boolean,
) {
  const built = buildSwapInviteEmail({
    requesterName: payload.requesterName,
    cartName: payload.cartName,
    dateLabel: formatDateLabel(payload.date),
    period: payload.period,
    mode: payload.mode,
    offeredCartName: payload.offeredCartName,
    message: payload.message,
    localTesting,
  });
  const subject = localTesting ? localSubject(built.subject) : built.subject;
  const result = await sendEmail({
    to,
    subject,
    html: built.html,
    text: built.text,
    tags: ["swap-invite", payload.mode, ...(localTesting ? ["local-dev"] : [])],
  });
  if (!result.ok) return { ok: false as const, error: result.error };
  return { ok: true as const, sent: result.skipped ? 0 : 1 };
}

async function sendSwapInviteUpdateTo(
  to: { email: string; name?: string },
  payload: Extract<NotificationPayload, { type: "swap_invite_update" }>,
  localTesting?: boolean,
) {
  const built = buildSwapInviteUpdateEmail({
    decision: payload.decision,
    deciderName: payload.deciderName,
    cartName: payload.cartName,
    dateLabel: formatDateLabel(payload.date),
    period: payload.period,
    mode: payload.mode,
    localTesting,
  });
  const subject = localTesting ? localSubject(built.subject) : built.subject;
  const result = await sendEmail({
    to,
    subject,
    html: built.html,
    text: built.text,
    tags: [
      "swap-invite-update",
      payload.decision,
      ...(localTesting ? ["local-dev"] : []),
    ],
  });
  if (!result.ok) return { ok: false as const, error: result.error };
  return { ok: true as const, sent: result.skipped ? 0 : 1 };
}

async function handleSwapInvite(
  admin: ReturnType<typeof createAdminClient>,
  payload: Extract<NotificationPayload, { type: "swap_invite" }>,
) {
  const owner = await loadMailUser(admin, payload.ownerId);
  if (!owner) return { ok: true as const, sent: 0 };
  return sendSwapInviteTo(owner, payload, false);
}

async function handleSwapInviteUpdate(
  admin: ReturnType<typeof createAdminClient>,
  payload: Extract<NotificationPayload, { type: "swap_invite_update" }>,
) {
  const requester = await loadMailUser(admin, payload.requesterId);
  if (!requester) return { ok: true as const, sent: 0 };
  return sendSwapInviteUpdateTo(requester, payload, false);
}

async function sendDevTest(email: string) {
  const built = buildDevTestEmail({ sinkEmail: email });
  const result = await sendEmail({
    to: { email, name: "Local sink" },
    subject: built.subject,
    html: built.html,
    text: built.text,
    tags: ["local-dev", "dev-test"],
  });
  if (!result.ok) return { ok: false, error: result.error };
  return {
    ok: true,
    sent: result.skipped ? 0 : 1,
    skipped: result.skipped,
    messageId: result.messageId,
  };
}

async function sendSelfTestTo(
  to: { email: string; name?: string },
  localTesting?: boolean,
) {
  const built = localTesting
    ? buildDevTestEmail({ sinkEmail: to.email })
    : buildSelfTestEmail({ name: to.name });
  const subject = localTesting ? localSubject(built.subject) : built.subject;
  const result = await sendEmail({
    to,
    subject,
    html: built.html,
    text: built.text,
    tags: ["self-test", ...(localTesting ? ["local-dev"] : [])],
  });
  if (!result.ok) return { ok: false as const, error: result.error };
  return {
    ok: true as const,
    sent: result.skipped ? 0 : 1,
    skipped: result.skipped,
    messageId: result.messageId,
  };
}

async function handleSelfTest(
  admin: ReturnType<typeof createAdminClient>,
  actorId: string,
  actor?: { email: string | null; name: string | null },
) {
  const user = await loadMailUser(admin, actorId, { ignorePref: true });
  const email = user?.email || actor?.email || null;
  if (!email?.includes("@")) {
    return {
      ok: false as const,
      error: "Your account has no email address on file.",
    };
  }
  return sendSelfTestTo(
    { email, name: user?.name || actor?.name || undefined },
    false,
  );
}

async function sendIssueEmail(opts: {
  recipients: Array<{ email: string; name?: string }>;
  payload: Extract<NotificationPayload, { type: "issue_reported" }>;
  subjectPrefix?: boolean;
}) {
  const description = String(opts.payload.description ?? "").trim();
  const severity = String(opts.payload.severity ?? "medium").toLowerCase();
  const reporterName = String(opts.payload.reporterName ?? "A teacher").trim();
  const cartName = String(opts.payload.cartName ?? "Cart").trim() || "Cart";

  if (!description) {
    return { ok: false, error: "Missing issue details." };
  }
  if (opts.recipients.length === 0) {
    return { ok: true, sent: 0 };
  }

  const built = buildIssueReportEmail({
    reporterName,
    cartName,
    severity,
    description,
    localTesting: Boolean(opts.subjectPrefix),
  });
  const subject = opts.subjectPrefix
    ? localSubject(built.subject)
    : built.subject;

  const results = await Promise.all(
    opts.recipients.map((row) =>
      sendEmail({
        to: row,
        subject,
        html: built.html,
        text: built.text,
        tags: [
          "issue-report",
          `severity-${severity}`,
          ...(opts.subjectPrefix ? ["local-dev"] : []),
        ],
      }),
    ),
  );
  const sent = results.filter((result) => result.ok && !result.skipped).length;

  return { ok: true, sent };
}

async function sendShareEmail(opts: {
  to: { email: string; name?: string };
  payload: Extract<NotificationPayload, { type: "share_invite" }>;
  subjectPrefix?: boolean;
}) {
  const inviterName = String(opts.payload.inviterName ?? "A colleague").trim();
  const cartName = String(opts.payload.cartName ?? "a cart").trim();
  const date = String(opts.payload.date ?? "").trim();
  const period = String(opts.payload.period ?? "").trim();

  let dateLabel = date;
  try {
    if (date) dateLabel = format(parseISO(date), "EEE, MMM d");
  } catch {
    /* keep raw */
  }

  const built = buildShareInviteEmail({
    inviterName,
    cartName,
    dateLabel,
    period,
    localTesting: Boolean(opts.subjectPrefix),
  });
  const subject = opts.subjectPrefix
    ? localSubject(built.subject)
    : built.subject;

  const result = await sendEmail({
    to: opts.to,
    subject,
    html: built.html,
    text: built.text,
    tags: ["share-invite", ...(opts.subjectPrefix ? ["local-dev"] : [])],
  });

  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, sent: result.skipped ? 0 : 1 };
}

async function handleIssueReported(
  admin: ReturnType<typeof createAdminClient>,
  actorId: string,
  payload: Extract<NotificationPayload, { type: "issue_reported" }>,
) {
  const cartId = String(payload.cartId ?? "").trim();
  if (!cartId) {
    return { ok: false, error: "Missing issue details." };
  }

  let cartName = String(payload.cartName ?? "").trim();
  if (!cartName) {
    const { data: cart } = await admin
      .from("carts")
      .select("name")
      .eq("id", cartId)
      .maybeSingle();
    cartName = (cart as { name?: string } | null)?.name?.trim() || "Cart";
  }

  const admins = await selectMailProfiles(admin, { role: "admin" });
  const recipients = admins
    .filter(
      (row) =>
        row.id !== actorId &&
        row.notify_issues !== false &&
        Boolean(row.email?.includes("@")),
    )
    .map((row) => ({
      email: row.email!,
      name: row.name ?? undefined,
    }));

  return sendIssueEmail({
    recipients,
    payload: { ...payload, cartName },
  });
}

async function handleShareInvite(
  admin: ReturnType<typeof createAdminClient>,
  actorId: string,
  payload: Extract<NotificationPayload, { type: "share_invite" }>,
) {
  const inviteeId = String(payload.inviteeId ?? "").trim();
  if (!inviteeId || inviteeId === actorId) {
    return { ok: false, error: "Invalid invitee." };
  }

  const user = await loadMailUser(admin, inviteeId);
  if (!user) {
    return { ok: true, sent: 0, skipped: true };
  }

  return sendShareEmail({
    to: user,
    payload,
  });
}

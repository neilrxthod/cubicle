import { NextResponse } from "next/server";
import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isBrevoConfigured, sendEmail } from "@/lib/email/brevo";
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

/**
 * Authenticated (production) / local-sink notification dispatch via Brevo.
 *
 * Local: default no-send. Only when Settings testing toggle is on and a sink
 * email is set — and only if the server itself is in local runtime.
 * Production: real recipients; client sink is ignored.
 */
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
  try {
    const supabase = await createClient();
    const {
      data: { user: actor },
    } = await supabase.auth.getUser();
    actorId = actor?.id ?? null;
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
    const result = await dispatchProduction(admin, actorId!, body);
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
  return { error: "Unknown notification type.", ok: false as const };
}

async function dispatchProduction(
  admin: ReturnType<typeof createAdminClient>,
  actorId: string,
  body: NotificationPayload,
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
  return { error: "Unknown notification type.", ok: false as const };
}

async function loadMailUser(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<{ email: string; name?: string } | null> {
  const { data } = await admin
    .from("profiles")
    .select("id, email, name, notify_email")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;
  const row = data as {
    email: string | null;
    name: string | null;
    notify_email: boolean | null;
  };
  if (row.notify_email === false || !row.email?.includes("@")) return null;
  return { email: row.email, name: row.name ?? undefined };
}

async function loadAdminRecipients(
  admin: ReturnType<typeof createAdminClient>,
  excludeIds: string[] = [],
): Promise<Array<{ email: string; name?: string }>> {
  const exclude = new Set(excludeIds);
  const { data, error } = await admin
    .from("profiles")
    .select("id, email, name, role, notify_email, notify_issues")
    .eq("role", "admin");
  if (error) {
    console.error("[notifications] load admins", error.message);
    return [];
  }
  return ((data ?? []) as ProfileMailRow[])
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
  let sent = 0;
  for (const to of recipients) {
    const result = await sendEmail({
      to,
      subject,
      html: built.html,
      text: built.text,
      tags: ["booking-relocated", payload.reason, ...(localTesting ? ["local-dev"] : [])],
    });
    if (result.ok && !result.skipped) sent += 1;
  }
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
  let sent = 0;
  for (const to of recipients) {
    const result = await sendEmail({
      to,
      subject,
      html: built.html,
      text: built.text,
      tags: ["booking-cancelled", payload.reason, ...(localTesting ? ["local-dev"] : [])],
    });
    if (result.ok && !result.skipped) sent += 1;
  }
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
  let sent = 0;
  const a = await loadMailUser(admin, payload.teacherAId);
  if (a) {
    const r = await sendExchangeTo(a, payload, "A", false);
    if (r.ok) sent += r.sent ?? 0;
  }
  const b = await loadMailUser(admin, payload.teacherBId);
  if (b) {
    const r = await sendExchangeTo(b, payload, "B", false);
    if (r.ok) sent += r.sent ?? 0;
  }
  return { ok: true as const, sent };
}

async function handleSwapHandoff(
  admin: ReturnType<typeof createAdminClient>,
  payload: Extract<NotificationPayload, { type: "swap_handoff" }>,
) {
  let sent = 0;
  const owner = await loadMailUser(admin, payload.fromTeacherId);
  if (owner) {
    const r = await sendHandoffTo(owner, payload, "owner", false);
    if (r.ok) sent += r.sent ?? 0;
  }
  const receiver = await loadMailUser(admin, payload.toTeacherId);
  if (receiver) {
    const r = await sendHandoffTo(receiver, payload, "receiver", false);
    if (r.ok) sent += r.sent ?? 0;
  }
  const admins = await loadAdminRecipients(admin, [
    payload.fromTeacherId,
    payload.toTeacherId,
  ]);
  for (const adminTo of admins) {
    const r = await sendHandoffTo(adminTo, payload, "admin", false);
    if (r.ok) sent += r.sent ?? 0;
  }
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
  return { ok: true, sent: result.skipped ? 0 : 1, skipped: result.skipped };
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

  let sent = 0;
  for (const row of opts.recipients) {
    const result = await sendEmail({
      to: row,
      subject,
      html: built.html,
      text: built.text,
      tags: [
        "issue-report",
        `severity-${severity}`,
        ...(opts.subjectPrefix ? ["local-dev"] : []),
      ],
    });
    if (result.ok && !result.skipped) sent += 1;
  }

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

  const { data: admins, error } = await admin
    .from("profiles")
    .select("id, email, name, role, notify_email, notify_issues")
    .eq("role", "admin");

  if (error) {
    console.error("[notifications] load admins", error.message);
    return { ok: false, error: "Could not load recipients." };
  }

  const recipients = ((admins ?? []) as ProfileMailRow[])
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

  const { data: invitee, error } = await admin
    .from("profiles")
    .select("id, email, name, role, notify_email, notify_issues")
    .eq("id", inviteeId)
    .maybeSingle();

  if (error || !invitee) {
    return { ok: false, error: "Invitee not found." };
  }

  const row = invitee as ProfileMailRow;
  if (row.notify_email === false || !row.email?.includes("@")) {
    return { ok: true, sent: 0, skipped: true };
  }

  return sendShareEmail({
    to: { email: row.email!, name: row.name ?? undefined },
    payload,
  });
}

import { NextResponse } from "next/server";
import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isBrevoConfigured, sendEmail } from "@/lib/email/brevo";
import {
  emailShell,
  escapeHtml,
  plainTextFromLines,
} from "@/lib/email/templates";
import { SITE_ORIGIN } from "@/lib/site";
import type { NotificationPayload } from "@/lib/email/queue";

type ProfileMailRow = {
  id: string;
  email: string | null;
  name: string | null;
  role: string | null;
  notify_email: boolean | null;
  notify_issues: boolean | null;
};

/**
 * Authenticated notification dispatch (Brevo).
 * Body: NotificationPayload — see lib/email/queue.ts
 */
export async function POST(request: Request) {
  if (!isBrevoConfigured()) {
    return NextResponse.json(
      { ok: true, skipped: true, reason: "Brevo not configured" },
      { status: 200 },
    );
  }

  let payload: NotificationPayload;
  try {
    payload = (await request.json()) as NotificationPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!payload || typeof payload !== "object" || !("type" in payload)) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json(
      { error: "Auth is not configured." },
      { status: 503 },
    );
  }

  const {
    data: { user: actor },
    error: actorError,
  } = await supabase.auth.getUser();

  if (actorError || !actor) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
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
    if (payload.type === "issue_reported") {
      const result = await handleIssueReported(admin, actor.id, payload);
      return NextResponse.json(result);
    }
    if (payload.type === "share_invite") {
      const result = await handleShareInvite(admin, actor.id, payload);
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: "Unknown notification type." }, { status: 400 });
  } catch (err) {
    console.error("[notifications]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send." },
      { status: 500 },
    );
  }
}

async function handleIssueReported(
  admin: ReturnType<typeof createAdminClient>,
  actorId: string,
  payload: Extract<NotificationPayload, { type: "issue_reported" }>,
) {
  const description = String(payload.description ?? "").trim();
  const severity = String(payload.severity ?? "medium").toLowerCase();
  const reporterName = String(payload.reporterName ?? "A teacher").trim();
  const cartId = String(payload.cartId ?? "").trim();

  if (!description || !cartId) {
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

  const recipients = ((admins ?? []) as ProfileMailRow[]).filter(
    (row) =>
      row.id !== actorId &&
      row.notify_issues !== false &&
      Boolean(row.email?.includes("@")),
  );

  if (recipients.length === 0) {
    return { ok: true, sent: 0 };
  }

  const title =
    severity === "high"
      ? `High severity issue · ${cartName}`
      : `Issue reported · ${cartName}`;

  const bodyHtml = `
    <p style="margin:0 0 12px;">
      <strong>${escapeHtml(reporterName)}</strong> reported an issue on
      <strong>${escapeHtml(cartName)}</strong>.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 12px;font-size:13px;">
      <tr>
        <td style="padding:6px 0;color:#737373;width:88px;">Severity</td>
        <td style="padding:6px 0;color:#0a0a0a;text-transform:capitalize;">${escapeHtml(severity)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#737373;vertical-align:top;">Details</td>
        <td style="padding:6px 0;color:#0a0a0a;white-space:pre-wrap;">${escapeHtml(description)}</td>
      </tr>
    </table>
  `;

  const html = emailShell({
    title,
    bodyHtml,
    cta: { label: "Open issues", href: `${SITE_ORIGIN}/issues` },
  });
  const text = plainTextFromLines([
    title,
    "",
    `${reporterName} reported an issue on ${cartName}.`,
    `Severity: ${severity}`,
    `Details: ${description}`,
    "",
    `Open: ${SITE_ORIGIN}/issues`,
  ]);

  let sent = 0;
  for (const row of recipients) {
    const result = await sendEmail({
      to: {
        email: row.email!,
        name: row.name ?? undefined,
      },
      subject: title,
      html,
      text,
      tags: ["issue-report", `severity-${severity}`],
    });
    if (result.ok && !result.skipped) sent += 1;
  }

  return { ok: true, sent };
}

async function handleShareInvite(
  admin: ReturnType<typeof createAdminClient>,
  actorId: string,
  payload: Extract<NotificationPayload, { type: "share_invite" }>,
) {
  const inviteeId = String(payload.inviteeId ?? "").trim();
  const inviterName = String(payload.inviterName ?? "A colleague").trim();
  const cartName = String(payload.cartName ?? "a cart").trim();
  const date = String(payload.date ?? "").trim();
  const period = String(payload.period ?? "").trim();

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

  let dateLabel = date;
  try {
    if (date) dateLabel = format(parseISO(date), "EEE, MMM d");
  } catch {
    /* keep raw */
  }

  const title = `${inviterName} invited you to share a cart`;
  const bodyHtml = `
    <p style="margin:0 0 12px;">
      <strong>${escapeHtml(inviterName)}</strong> wants to share
      <strong>${escapeHtml(cartName)}</strong> with you.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 12px;font-size:13px;">
      <tr>
        <td style="padding:6px 0;color:#737373;width:88px;">When</td>
        <td style="padding:6px 0;color:#0a0a0a;">${escapeHtml(dateLabel)}${period ? ` · ${escapeHtml(period)}` : ""}</td>
      </tr>
    </table>
    <p style="margin:0;color:#525252;">Accept or decline the invite in Cubicle.</p>
  `;

  const html = emailShell({
    title,
    bodyHtml,
    cta: { label: "Open Cubicle", href: SITE_ORIGIN },
  });
  const text = plainTextFromLines([
    title,
    "",
    `${inviterName} invited you to share ${cartName}.`,
    `When: ${dateLabel}${period ? ` · ${period}` : ""}`,
    "",
    `Open: ${SITE_ORIGIN}`,
  ]);

  const result = await sendEmail({
    to: { email: row.email!, name: row.name ?? undefined },
    subject: title,
    html,
    text,
    tags: ["share-invite"],
  });

  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, sent: result.skipped ? 0 : 1 };
}

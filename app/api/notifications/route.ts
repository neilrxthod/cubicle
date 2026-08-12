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
  buildDevTestEmail,
  buildIssueReportEmail,
  buildShareInviteEmail,
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

  // Production paths need admin client for recipient lookup.
  // Local sink can send from payload alone without DB.
  if (plan.mode === "local_sink") {
    try {
      if (body.type === "issue_reported") {
        return NextResponse.json(
          await sendIssueEmail({
            recipients: [{ email: plan.email, name: "Local sink" }],
            payload: body,
            subjectPrefix: true,
          }),
        );
      }
      if (body.type === "share_invite") {
        return NextResponse.json(
          await sendShareEmail({
            to: { email: plan.email, name: "Local sink" },
            payload: body,
            subjectPrefix: true,
          }),
        );
      }
      return NextResponse.json(
        { error: "Unknown notification type." },
        { status: 400 },
      );
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
    if (body.type === "issue_reported") {
      const result = await handleIssueReported(admin, actorId!, body);
      return NextResponse.json(result);
    }
    if (body.type === "share_invite") {
      const result = await handleShareInvite(admin, actorId!, body);
      return NextResponse.json(result);
    }
    return NextResponse.json(
      { error: "Unknown notification type." },
      { status: 400 },
    );
  } catch (err) {
    console.error("[notifications]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send." },
      { status: 500 },
    );
  }
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

import { SITE_DOMAIN, SITE_ORIGIN } from "@/lib/site";

/**
 * Cubicle transactional email templates.
 * Table + inline CSS only (Gmail / Outlook safe). Monochrome brand system.
 */

type MetaRow = { label: string; value: string; multiline?: boolean };

type ShellOpts = {
  /** Inbox preview text (hidden in body). */
  preheader?: string;
  /** Small uppercase eyebrow above the title (e.g. "Issue report"). */
  eyebrow?: string;
  title: string;
  /** Optional one-line summary under the title. */
  lead?: string;
  bodyHtml: string;
  cta?: { label: string; href: string };
  /** Soft notice under the CTA (e.g. local testing). */
  banner?: { tone: "neutral" | "amber"; text: string };
};

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** Primary shell — black header, white card, quiet footer. */
export function emailShell(opts: ShellOpts): string {
  const preheader = opts.preheader
    ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
        ${escapeHtml(opts.preheader)}
      </div>`
    : "";

  const eyebrow = opts.eyebrow
    ? `<p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#a3a3a3;">
        ${escapeHtml(opts.eyebrow)}
      </p>`
    : "";

  const lead = opts.lead
    ? `<p style="margin:0 0 20px;font-size:14px;line-height:1.55;color:#525252;">
        ${escapeHtml(opts.lead)}
      </p>`
    : "";

  const banner = opts.banner
    ? metaBanner(opts.banner.tone, opts.banner.text)
    : "";

  const cta = opts.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 0;">
        <tr>
          <td style="border-radius:8px;background:#0a0a0a;">
            <a href="${escapeAttr(opts.cta.href)}"
               style="display:inline-block;padding:12px 20px;font-size:13px;font-weight:600;letter-spacing:-0.01em;color:#ffffff;text-decoration:none;border-radius:8px;">
              ${escapeHtml(opts.cta.label)}
            </a>
          </td>
        </tr>
      </table>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:${FONT};-webkit-font-smoothing:antialiased;">
  ${preheader}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;border-collapse:separate;">
          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border:1px solid #e5e5e5;border-radius:14px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,0.04);">
              <!-- Brand bar -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:18px 28px;background:#0a0a0a;">
                    <p style="margin:0;font-size:12px;font-weight:600;letter-spacing:0.34em;text-transform:uppercase;color:#fafafa;">
                      Cubicle
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Body -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:28px 28px 8px;">
                    ${eyebrow}
                    <h1 style="margin:0 0 ${opts.lead ? "10px" : "20px"};font-size:20px;font-weight:600;line-height:1.3;letter-spacing:-0.025em;color:#0a0a0a;">
                      ${escapeHtml(opts.title)}
                    </h1>
                    ${lead}
                    ${banner}
                    <div style="font-size:14px;line-height:1.55;color:#404040;">
                      ${opts.bodyHtml}
                    </div>
                    ${cta}
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 28px 28px;"></td>
                </tr>
              </table>

              <!-- Footer strip inside card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:16px 28px;border-top:1px solid #f0f0f0;background:#fafafa;">
                    <p style="margin:0 0 4px;font-size:12px;line-height:1.45;color:#737373;">
                      Notification from Cubicle for authorized school staff.
                    </p>
                    <p style="margin:0;font-size:12px;line-height:1.45;color:#a3a3a3;">
                      <a href="${escapeAttr(`${SITE_ORIGIN}/settings`)}" style="color:#737373;text-decoration:underline;">Notification settings</a>
                      &nbsp;·&nbsp;
                      <a href="${escapeAttr(SITE_ORIGIN)}" style="color:#737373;text-decoration:underline;">${escapeHtml(SITE_DOMAIN)}</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Outside footer -->
          <tr>
            <td align="center" style="padding:20px 8px 0;">
              <p style="margin:0;font-size:11px;line-height:1.5;color:#a3a3a3;letter-spacing:0.02em;">
                © ${new Date().getFullYear()} Cubicle · Cart booking for school staff
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function metaBanner(tone: "neutral" | "amber", text: string): string {
  const bg = tone === "amber" ? "#fffbeb" : "#f5f5f5";
  const border = tone === "amber" ? "#fde68a" : "#e5e5e5";
  const color = tone === "amber" ? "#92400e" : "#525252";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
    <tr>
      <td style="padding:10px 12px;background:${bg};border:1px solid ${border};border-radius:8px;font-size:12.5px;line-height:1.45;color:${color};">
        ${escapeHtml(text)}
      </td>
    </tr>
  </table>`;
}

/** Labeled detail panel used across notification types. */
export function emailMetaTable(rows: MetaRow[]): string {
  if (rows.length === 0) return "";
  const cells = rows
    .map((row, i) => {
      const border =
        i < rows.length - 1 ? "border-bottom:1px solid #f0f0f0;" : "";
      const valueStyle = row.multiline
        ? "white-space:pre-wrap;word-break:break-word;"
        : "";
      return `<tr>
        <td style="padding:11px 14px;width:108px;vertical-align:top;font-size:12px;font-weight:500;letter-spacing:0.02em;text-transform:uppercase;color:#a3a3a3;${border}">
          ${escapeHtml(row.label)}
        </td>
        <td style="padding:11px 14px;vertical-align:top;font-size:14px;font-weight:500;letter-spacing:-0.01em;color:#0a0a0a;${border}${valueStyle}">
          ${escapeHtml(row.value)}
        </td>
      </tr>`;
    })
    .join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0;border:1px solid #ebebeb;border-radius:10px;overflow:hidden;background:#fcfcfc;">
    ${cells}
  </table>`;
}

export function severityBadge(severity: string): string {
  const s = severity.toLowerCase();
  let bg = "#f5f5f5";
  let color = "#404040";
  let border = "#e5e5e5";
  if (s === "high") {
    bg = "#fef2f2";
    color = "#b91c1c";
    border = "#fecaca";
  } else if (s === "medium") {
    bg = "#fffbeb";
    color = "#b45309";
    border = "#fde68a";
  } else if (s === "low") {
    bg = "#ecfdf5";
    color = "#047857";
    border = "#a7f3d0";
  }
  const label = s.charAt(0).toUpperCase() + s.slice(1);
  return `<span style="display:inline-block;padding:3px 9px;border-radius:999px;border:1px solid ${border};background:${bg};font-size:12px;font-weight:600;letter-spacing:-0.01em;color:${color};">${escapeHtml(label)}</span>`;
}

// ─── Typed notification builders ────────────────────────────────────────────

export function buildIssueReportEmail(input: {
  reporterName: string;
  cartName: string;
  severity: string;
  description: string;
  localTesting?: boolean;
}): { subject: string; html: string; text: string; title: string } {
  const severity = input.severity.toLowerCase();
  const isHigh = severity === "high";
  const title = isHigh
    ? `High severity · ${input.cartName}`
    : `Issue on ${input.cartName}`;
  const subject = isHigh
    ? `High severity issue · ${input.cartName}`
    : `Issue reported · ${input.cartName}`;

  const bodyHtml = `
    <p style="margin:0 0 18px;font-size:14px;line-height:1.55;color:#404040;">
      <strong style="color:#0a0a0a;font-weight:600;">${escapeHtml(input.reporterName)}</strong>
      reported a cart issue that needs attention.
    </p>
    ${emailMetaTable([
      { label: "Cart", value: input.cartName },
      { label: "Severity", value: severity.charAt(0).toUpperCase() + severity.slice(1) },
      { label: "Reporter", value: input.reporterName },
      { label: "Details", value: input.description, multiline: true },
    ])}
    <p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:#737373;">
      Severity
      &nbsp;${severityBadge(severity)}
    </p>
  `;

  const html = emailShell({
    preheader: `${input.reporterName} · ${input.cartName} · ${severity}`,
    eyebrow: "Issue report",
    title,
    lead: isHigh
      ? "High severity may place the cart in maintenance. Review promptly."
      : "Review the report and update status when resolved.",
    bodyHtml,
    cta: { label: "View issues", href: `${SITE_ORIGIN}/issues` },
    banner: input.localTesting
      ? {
          tone: "amber",
          text: "Local testing — this message was redirected to your sink address.",
        }
      : undefined,
  });

  const text = plainTextFromLines([
    subject,
    "",
    `${input.reporterName} reported an issue on ${input.cartName}.`,
    `Severity: ${severity}`,
    `Details: ${input.description}`,
    "",
    `Open: ${SITE_ORIGIN}/issues`,
  ]);

  return { subject, html, text, title };
}

export function buildShareInviteEmail(input: {
  inviterName: string;
  cartName: string;
  dateLabel: string;
  period: string;
  localTesting?: boolean;
}): { subject: string; html: string; text: string; title: string } {
  const title = "Cart share invite";
  const subject = `${input.inviterName} invited you to share a cart`;
  const when = [input.dateLabel, input.period].filter(Boolean).join(" · ");

  const bodyHtml = `
    <p style="margin:0 0 18px;font-size:14px;line-height:1.55;color:#404040;">
      <strong style="color:#0a0a0a;font-weight:600;">${escapeHtml(input.inviterName)}</strong>
      wants to share a laptop cart booking with you.
    </p>
    ${emailMetaTable([
      { label: "From", value: input.inviterName },
      { label: "Cart", value: input.cartName },
      { label: "When", value: when || "—" },
    ])}
    <p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:#737373;">
      Accept or decline the invite from your Cubicle board.
    </p>
  `;

  const html = emailShell({
    preheader: `${input.inviterName} · ${input.cartName} · ${when}`,
    eyebrow: "Share request",
    title,
    lead: "You’ll both appear on the booking once you accept.",
    bodyHtml,
    cta: { label: "Open Cubicle", href: SITE_ORIGIN },
    banner: input.localTesting
      ? {
          tone: "amber",
          text: "Local testing — this message was redirected to your sink address.",
        }
      : undefined,
  });

  const text = plainTextFromLines([
    subject,
    "",
    `${input.inviterName} invited you to share ${input.cartName}.`,
    `When: ${when}`,
    "",
    `Open: ${SITE_ORIGIN}`,
  ]);

  return { subject, html, text, title };
}

export function buildDevTestEmail(input: {
  sinkEmail: string;
}): { subject: string; html: string; text: string } {
  const subject = "[Cubicle local] Test notification";
  const bodyHtml = `
    <p style="margin:0 0 18px;font-size:14px;line-height:1.55;color:#404040;">
      Local email testing is connected. Future issue and share notifications
      from this machine will land in this inbox only.
    </p>
    ${emailMetaTable([
      { label: "Mode", value: "Local development" },
      { label: "Sink", value: input.sinkEmail },
      { label: "Provider", value: "Brevo" },
    ])}
  `;

  const html = emailShell({
    preheader: "Cubicle local email test succeeded",
    eyebrow: "Local testing",
    title: "Test notification",
    lead: "You’re set up to receive redirected notification mail.",
    bodyHtml,
    cta: { label: "Open settings", href: `${SITE_ORIGIN}/settings` },
    banner: {
      tone: "amber",
      text: "Local only — production school staff never see this path.",
    },
  });

  const text = plainTextFromLines([
    "Cubicle local test",
    "",
    "Local email testing is working.",
    `Sink: ${input.sinkEmail}`,
    "",
    `Settings: ${SITE_ORIGIN}/settings`,
  ]);

  return { subject, html, text };
}

export function buildSelfTestEmail(input: {
  name?: string;
}): { subject: string; html: string; text: string } {
  const subject = "Cubicle email is working";
  const greeting = input.name?.trim() || "there";
  const bodyHtml = `
    <p style="margin:0 0 18px;font-size:14px;line-height:1.55;color:#404040;">
      Hi ${escapeHtml(greeting)} — this is a test from Cubicle. If you’re
      reading this, production notifications can reach your inbox.
    </p>
    ${emailMetaTable([
      { label: "Mode", value: "Production" },
      { label: "Provider", value: "Brevo" },
    ])}
    <p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:#737373;">
      You’ll still only get schedule and issue mail when those toggles are on
      in Settings.
    </p>
  `;

  const html = emailShell({
    preheader: "Cubicle can deliver mail to this inbox",
    eyebrow: "Email test",
    title: "Test notification",
    lead: "Staff notifications from this deployment are reaching you.",
    bodyHtml,
    cta: { label: "Open settings", href: `${SITE_ORIGIN}/settings` },
  });

  const text = plainTextFromLines([
    subject,
    "",
    "This is a test from Cubicle. Production notifications can reach this inbox.",
    "",
    `Settings: ${SITE_ORIGIN}/settings`,
  ]);

  return { subject, html, text };
}

function whenLabel(dateLabel: string, period: string): string {
  return [dateLabel, period].filter(Boolean).join(" · ") || "—";
}

export function buildBookingRelocatedEmail(input: {
  fromCartName: string;
  toCartName: string;
  dateLabel: string;
  period: string;
  reason: "maintenance" | "admin";
  localTesting?: boolean;
}): { subject: string; html: string; text: string } {
  const when = whenLabel(input.dateLabel, input.period);
  const maintenance = input.reason === "maintenance";
  const subject = maintenance
    ? `Booking moved · ${input.toCartName}`
    : `Cart updated · ${input.toCartName}`;
  const title = "Your booking was moved";
  const lead = maintenance
    ? `${input.fromCartName} was placed in maintenance. Your reservation was reassigned so you keep the same slot.`
    : `An administrator moved your reservation to a different cart.`;

  const bodyHtml = `
    <p style="margin:0 0 18px;font-size:14px;line-height:1.55;color:#404040;">
      ${escapeHtml(lead)}
    </p>
    ${emailMetaTable([
      { label: "When", value: when },
      { label: "From", value: input.fromCartName },
      { label: "To", value: input.toCartName },
      {
        label: "Reason",
        value: maintenance ? "Cart maintenance" : "Admin reassignment",
      },
    ])}
    <p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:#737373;">
      Please use <strong style="color:#0a0a0a;">${escapeHtml(input.toCartName)}</strong> for this period.
    </p>
  `;

  const html = emailShell({
    preheader: `${input.fromCartName} → ${input.toCartName} · ${when}`,
    eyebrow: "Schedule change",
    title,
    lead: "Your date and period are unchanged.",
    bodyHtml,
    cta: { label: "Open schedule", href: SITE_ORIGIN },
    banner: input.localTesting
      ? {
          tone: "amber",
          text: "Local testing — redirected to your sink address.",
        }
      : undefined,
  });

  const text = plainTextFromLines([
    subject,
    "",
    lead,
    `When: ${when}`,
    `From: ${input.fromCartName}`,
    `To: ${input.toCartName}`,
    "",
    `Open: ${SITE_ORIGIN}`,
  ]);

  return { subject, html, text };
}

export function buildBookingCancelledEmail(input: {
  cartName: string;
  dateLabel: string;
  period: string;
  reason: "maintenance" | "admin";
  localTesting?: boolean;
}): { subject: string; html: string; text: string } {
  const when = whenLabel(input.dateLabel, input.period);
  const maintenance = input.reason === "maintenance";
  const subject = `Booking cancelled · ${input.cartName}`;
  const lead = maintenance
    ? `${input.cartName} was placed in maintenance and your reservation for this slot was cancelled.`
    : `An administrator cancelled your reservation on ${input.cartName}.`;

  const bodyHtml = `
    <p style="margin:0 0 18px;font-size:14px;line-height:1.55;color:#404040;">
      ${escapeHtml(lead)}
    </p>
    ${emailMetaTable([
      { label: "When", value: when },
      { label: "Cart", value: input.cartName },
      {
        label: "Reason",
        value: maintenance ? "Cart maintenance" : "Admin cancellation",
      },
    ])}
    <p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:#737373;">
      Book another cart on the board if you still need equipment.
    </p>
  `;

  const html = emailShell({
    preheader: `Cancelled · ${input.cartName} · ${when}`,
    eyebrow: "Schedule change",
    title: "Booking cancelled",
    lead: "This slot is no longer reserved for you.",
    bodyHtml,
    cta: { label: "Open schedule", href: SITE_ORIGIN },
    banner: input.localTesting
      ? {
          tone: "amber",
          text: "Local testing — redirected to your sink address.",
        }
      : undefined,
  });

  const text = plainTextFromLines([
    subject,
    "",
    lead,
    `When: ${when}`,
    `Cart: ${input.cartName}`,
    "",
    `Open: ${SITE_ORIGIN}`,
  ]);

  return { subject, html, text };
}

export function buildSwapExchangeEmail(input: {
  peerName: string;
  yourCartName: string;
  theirCartName: string;
  dateLabel: string;
  period: string;
  localTesting?: boolean;
}): { subject: string; html: string; text: string } {
  const when = whenLabel(input.dateLabel, input.period);
  const subject = `Cart exchange · ${input.theirCartName}`;
  const bodyHtml = `
    <p style="margin:0 0 18px;font-size:14px;line-height:1.55;color:#404040;">
      Your cart exchange with
      <strong style="color:#0a0a0a;font-weight:600;">${escapeHtml(input.peerName)}</strong>
      is complete.
    </p>
    ${emailMetaTable([
      { label: "When", value: when },
      { label: "You now have", value: input.theirCartName },
      { label: "They now have", value: input.yourCartName },
      { label: "With", value: input.peerName },
    ])}
  `;

  const html = emailShell({
    preheader: `Exchanged with ${input.peerName} · ${when}`,
    eyebrow: "Cart exchange",
    title: "Exchange complete",
    lead: "Both of you have new carts for this period.",
    bodyHtml,
    cta: { label: "Open schedule", href: SITE_ORIGIN },
    banner: input.localTesting
      ? {
          tone: "amber",
          text: "Local testing — redirected to your sink address.",
        }
      : undefined,
  });

  const text = plainTextFromLines([
    subject,
    "",
    `Exchange with ${input.peerName} is complete.`,
    `When: ${when}`,
    `You now have: ${input.theirCartName}`,
    `They now have: ${input.yourCartName}`,
    "",
    `Open: ${SITE_ORIGIN}`,
  ]);

  return { subject, html, text };
}

export function buildSwapHandoffEmail(input: {
  role: "receiver" | "owner" | "admin";
  fromTeacherName: string;
  toTeacherName: string;
  cartName: string;
  dateLabel: string;
  period: string;
  localTesting?: boolean;
}): { subject: string; html: string; text: string } {
  const when = whenLabel(input.dateLabel, input.period);

  if (input.role === "receiver") {
    const subject = `Handoff received · ${input.cartName}`;
    const bodyHtml = `
      <p style="margin:0 0 18px;font-size:14px;line-height:1.55;color:#404040;">
        <strong style="color:#0a0a0a;font-weight:600;">${escapeHtml(input.fromTeacherName)}</strong>
        handed off a cart booking to you.
      </p>
      ${emailMetaTable([
        { label: "When", value: when },
        { label: "Cart", value: input.cartName },
        { label: "From", value: input.fromTeacherName },
      ])}
    `;
    const html = emailShell({
      preheader: `${input.cartName} · ${when}`,
      eyebrow: "Handoff",
      title: "You received a cart",
      lead: "This slot is now on your schedule.",
      bodyHtml,
      cta: { label: "Open schedule", href: SITE_ORIGIN },
      banner: input.localTesting
        ? {
            tone: "amber",
            text: "Local testing — redirected to your sink address.",
          }
        : undefined,
    });
    return {
      subject,
      html,
      text: plainTextFromLines([
        subject,
        "",
        `${input.fromTeacherName} handed off ${input.cartName} to you.`,
        `When: ${when}`,
        "",
        `Open: ${SITE_ORIGIN}`,
      ]),
    };
  }

  if (input.role === "owner") {
    const subject = `Handoff complete · ${input.cartName}`;
    const bodyHtml = `
      <p style="margin:0 0 18px;font-size:14px;line-height:1.55;color:#404040;">
        Your booking was handed off to
        <strong style="color:#0a0a0a;font-weight:600;">${escapeHtml(input.toTeacherName)}</strong>.
      </p>
      ${emailMetaTable([
        { label: "When", value: when },
        { label: "Cart", value: input.cartName },
        { label: "To", value: input.toTeacherName },
      ])}
    `;
    const html = emailShell({
      preheader: `Handed to ${input.toTeacherName} · ${when}`,
      eyebrow: "Handoff",
      title: "Booking handed off",
      lead: "This slot is no longer on your schedule.",
      bodyHtml,
      cta: { label: "Open schedule", href: SITE_ORIGIN },
      banner: input.localTesting
        ? {
            tone: "amber",
            text: "Local testing — redirected to your sink address.",
          }
        : undefined,
    });
    return {
      subject,
      html,
      text: plainTextFromLines([
        subject,
        "",
        `You handed ${input.cartName} to ${input.toTeacherName}.`,
        `When: ${when}`,
        "",
        `Open: ${SITE_ORIGIN}`,
      ]),
    };
  }

  // admin
  const subject = `Handoff · ${input.fromTeacherName} → ${input.toTeacherName}`;
  const bodyHtml = `
    <p style="margin:0 0 18px;font-size:14px;line-height:1.55;color:#404040;">
      A cart handoff was completed on the schedule.
    </p>
    ${emailMetaTable([
      { label: "When", value: when },
      { label: "Cart", value: input.cartName },
      { label: "From", value: input.fromTeacherName },
      { label: "To", value: input.toTeacherName },
    ])}
  `;
  const html = emailShell({
    preheader: `${input.cartName} · ${input.fromTeacherName} → ${input.toTeacherName}`,
    eyebrow: "Operations",
    title: "Handoff completed",
    lead: "Both teachers were notified of the change.",
    bodyHtml,
    cta: { label: "Open Cubicle", href: SITE_ORIGIN },
    banner: input.localTesting
      ? {
          tone: "amber",
          text: "Local testing — redirected to your sink address.",
        }
      : undefined,
  });
  return {
    subject,
    html,
    text: plainTextFromLines([
      subject,
      "",
      `Handoff: ${input.fromTeacherName} → ${input.toTeacherName}`,
      `Cart: ${input.cartName}`,
      `When: ${when}`,
      "",
      `Open: ${SITE_ORIGIN}`,
    ]),
  };
}

export function buildSwapInviteEmail(input: {
  requesterName: string;
  cartName: string;
  dateLabel: string;
  period: string;
  mode: "exchange" | "handoff";
  offeredCartName?: string;
  message?: string;
  localTesting?: boolean;
}): { subject: string; html: string; text: string } {
  const when = whenLabel(input.dateLabel, input.period);
  const isExchange = input.mode === "exchange";
  const subject = isExchange
    ? `Swap request · ${input.requesterName}`
    : `Handoff request · ${input.requesterName}`;

  const rows: Array<{ label: string; value: string; multiline?: boolean }> = [
    { label: "From", value: input.requesterName },
    { label: "When", value: when },
    { label: "Your cart", value: input.cartName },
    { label: "Type", value: isExchange ? "Exchange" : "Handoff" },
  ];
  if (isExchange && input.offeredCartName) {
    rows.push({ label: "They offer", value: input.offeredCartName });
  }
  if (input.message?.trim()) {
    rows.push({ label: "Note", value: input.message.trim(), multiline: true });
  }

  const bodyHtml = `
    <p style="margin:0 0 18px;font-size:14px;line-height:1.55;color:#404040;">
      <strong style="color:#0a0a0a;font-weight:600;">${escapeHtml(input.requesterName)}</strong>
      ${
        isExchange
          ? "wants to exchange carts for this period."
          : "is asking you to hand off this booking."
      }
    </p>
    ${emailMetaTable(rows)}
    <p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:#737373;">
      Accept or decline from your Cubicle board.
    </p>
  `;

  const html = emailShell({
    preheader: `${input.requesterName} · ${input.cartName} · ${when}`,
    eyebrow: isExchange ? "Swap invite" : "Handoff invite",
    title: isExchange ? "New swap request" : "New handoff request",
    lead: "A colleague is waiting on your response.",
    bodyHtml,
    cta: { label: "Review request", href: SITE_ORIGIN },
    banner: input.localTesting
      ? {
          tone: "amber",
          text: "Local testing — redirected to your sink address.",
        }
      : undefined,
  });

  const text = plainTextFromLines([
    subject,
    "",
    `${input.requesterName} requested a ${isExchange ? "swap" : "handoff"} on ${input.cartName}.`,
    `When: ${when}`,
    isExchange && input.offeredCartName
      ? `They offer: ${input.offeredCartName}`
      : "",
    input.message?.trim() ? `Note: ${input.message.trim()}` : "",
    "",
    `Open: ${SITE_ORIGIN}`,
  ]);

  return { subject, html, text };
}

export function buildSwapInviteUpdateEmail(input: {
  decision: "accepted" | "declined";
  deciderName: string;
  cartName: string;
  dateLabel: string;
  period: string;
  mode: "exchange" | "handoff";
  localTesting?: boolean;
}): { subject: string; html: string; text: string } {
  const when = whenLabel(input.dateLabel, input.period);
  const accepted = input.decision === "accepted";
  const kind = input.mode === "exchange" ? "swap" : "handoff";
  const subject = accepted
    ? `Request accepted · ${input.cartName}`
    : `Request declined · ${input.cartName}`;

  const bodyHtml = `
    <p style="margin:0 0 18px;font-size:14px;line-height:1.55;color:#404040;">
      <strong style="color:#0a0a0a;font-weight:600;">${escapeHtml(input.deciderName)}</strong>
      ${accepted ? "accepted" : "declined"} your ${kind} request.
    </p>
    ${emailMetaTable([
      { label: "Status", value: accepted ? "Accepted" : "Declined" },
      { label: "Cart", value: input.cartName },
      { label: "When", value: when },
      { label: "Type", value: input.mode === "exchange" ? "Exchange" : "Handoff" },
    ])}
    <p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:#737373;">
      ${
        accepted
          ? "Your schedule has been updated. Open Cubicle to confirm the board."
          : "You can request a different slot or offer another cart."
      }
    </p>
  `;

  const html = emailShell({
    preheader: `${input.deciderName} ${accepted ? "accepted" : "declined"} · ${when}`,
    eyebrow: "Request update",
    title: accepted ? "Request accepted" : "Request declined",
    lead: accepted
      ? "You’re all set for this period."
      : "This swap will not proceed.",
    bodyHtml,
    cta: { label: "Open schedule", href: SITE_ORIGIN },
    banner: input.localTesting
      ? {
          tone: "amber",
          text: "Local testing — redirected to your sink address.",
        }
      : undefined,
  });

  const text = plainTextFromLines([
    subject,
    "",
    `${input.deciderName} ${accepted ? "accepted" : "declined"} your ${kind} on ${input.cartName}.`,
    `When: ${when}`,
    "",
    `Open: ${SITE_ORIGIN}`,
  ]);

  return { subject, html, text };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

export function plainTextFromLines(lines: string[]): string {
  return lines.filter(Boolean).join("\n");
}

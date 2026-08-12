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

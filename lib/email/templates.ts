import { SITE_ORIGIN } from "@/lib/site";

/** Minimal corporate HTML shell — monochrome, no heavy branding. */
export function emailShell(opts: {
  title: string;
  bodyHtml: string;
  cta?: { label: string; href: string };
}): string {
  const cta = opts.cta
    ? `<p style="margin:24px 0 0;">
        <a href="${escapeAttr(opts.cta.href)}"
           style="display:inline-block;padding:10px 16px;background:#0a0a0a;color:#ffffff;text-decoration:none;font-size:13px;font-weight:500;border-radius:8px;">
          ${escapeHtml(opts.cta.label)}
        </a>
      </p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
<body style="margin:0;padding:0;background:#f6f6f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f7;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:20px 24px 8px;">
              <p style="margin:0;font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:#a3a3a3;font-weight:600;">Cubicle</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 24px;">
              <h1 style="margin:0 0 12px;font-size:17px;font-weight:600;color:#0a0a0a;letter-spacing:-0.02em;">${escapeHtml(opts.title)}</h1>
              <div style="font-size:14px;line-height:1.55;color:#404040;">
                ${opts.bodyHtml}
              </div>
              ${cta}
            </td>
          </tr>
          <tr>
            <td style="padding:14px 24px;border-top:1px solid #f0f0f0;">
              <p style="margin:0;font-size:11px;color:#a3a3a3;">
                You’re receiving this because of your Cubicle notification settings.
                <a href="${escapeAttr(`${SITE_ORIGIN}/settings`)}" style="color:#737373;">Manage preferences</a>
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

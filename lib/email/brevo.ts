/**
 * Brevo (Sendinblue) transactional email client.
 *
 * Env:
 *   BREVO_API_KEY        — REST API (blocked on Vercel if Authorized IPs is on)
 *   BREVO_SENDER_EMAIL   — verified sender in Brevo (required)
 *   BREVO_SENDER_NAME    — optional display name (default: Cubicle)
 *   BREVO_SMTP_USER      — SMTP login from Brevo → SMTP & API → SMTP
 *   BREVO_SMTP_KEY       — SMTP key (xsmtpsib-…), not the REST API key
 *
 * SMTP is the Vercel path: API-key IP blocking does not apply to SMTP keys
 * unless SMTP blocking is turned on separately (off by default).
 *
 * When API key or sender is missing, sends are skipped (no throw).
 * Callers should not block user flows on email failures.
 */

export type EmailAddress = {
  email: string;
  name?: string;
};

export type SendEmailInput = {
  to: EmailAddress | EmailAddress[];
  subject: string;
  html: string;
  text?: string;
  /** Optional Brevo tags for analytics */
  tags?: string[];
  replyTo?: EmailAddress;
};

export type SendEmailResult =
  | { ok: true; messageId?: string; skipped?: boolean; reason?: string }
  | { ok: false; error: string };

const BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";
const BREVO_AUTHORIZE_IP_URLS = [
  "https://api.brevo.com/v3/account/authorisedIps",
  "https://api.brevo.com/v3/security/authorisedIps",
] as const;

function brevoHeaders(apiKey: string): HeadersInit {
  return {
    accept: "application/json",
    "content-type": "application/json",
    "api-key": apiKey,
  };
}

function parseUnrecognizedIp(errText: string): string | null {
  const match = errText.match(
    /unrecogni[sz]ed IP address\s+(\d{1,3}(?:\.\d{1,3}){3})/i,
  );
  return match?.[1] ?? null;
}

function ipv4ToSlash24(ip: string): string | null {
  const parts = ip.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) {
    return null;
  }
  return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
}

function isUnrecognizedIpError(status: number, errText: string): boolean {
  if (status !== 401 && status !== 403) return false;
  return /unrecogni[sz]ed IP|authorised_ips|authorized ips/i.test(errText);
}

function describeBrevoError(status: number, errText: string): string {
  if (isUnrecognizedIpError(status, errText)) {
    return (
      "Brevo blocked this server address. Cubicle runs on Vercel, whose " +
      "outbound IPs change, so Authorized IP blocking for API keys must be " +
      "turned off at Settings → Security → Authorized IPs."
    );
  }
  if (status === 401) return "Mail provider rejected the API key.";
  if (status === 402) return "Mail provider account is out of credits.";
  return `Mail provider error (${status}).`;
}

/**
 * Best-effort: add the blocked Vercel IP (and its /24) to Brevo’s allowlist,
 * then the caller retries the send. The authorize call itself may also 401
 * if IP blocking applies to every API route — in that case this returns false.
 */
async function authorizeUnrecognizedIp(
  apiKey: string,
  ip: string,
): Promise<boolean> {
  const cidr = ipv4ToSlash24(ip);
  const bodies: Record<string, unknown>[] = [{ ip }];
  if (cidr) {
    bodies.push({ ip: cidr }, { ips: [ip, cidr] }, { ipAddresses: [ip, cidr] });
  }

  for (const url of BREVO_AUTHORIZE_IP_URLS) {
    for (const body of bodies) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: brevoHeaders(apiKey),
          body: JSON.stringify(body),
          cache: "no-store",
          signal: AbortSignal.timeout(12_000),
        });
        if (res.ok) {
          console.info("[brevo] authorized IP", ip);
          return true;
        }
        if (res.status === 401 || res.status === 403) return false;
        if (res.status === 404 || res.status === 405) break;
      } catch (err) {
        console.error(
          "[brevo] authorize IP failed",
          err instanceof Error ? err.message : "Network error",
        );
      }
    }
  }
  return false;
}

function getConfig() {
  const apiKey = process.env.BREVO_API_KEY?.trim() ?? "";
  const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim() ?? "";
  const senderName =
    process.env.BREVO_SENDER_NAME?.trim() || "Cubicle";
  return { apiKey, senderEmail, senderName };
}

function getSmtpConfig() {
  const user = process.env.BREVO_SMTP_USER?.trim() ?? "";
  const pass = process.env.BREVO_SMTP_KEY?.trim() ?? "";
  const host =
    process.env.BREVO_SMTP_HOST?.trim() || "smtp-relay.brevo.com";
  const port = Number(process.env.BREVO_SMTP_PORT?.trim() || "587");
  return { user, pass, host, port: Number.isFinite(port) ? port : 587 };
}

/** True when SMTP relay can be used (survives Vercel REST IP blocking). */
export function isSmtpConfigured(): boolean {
  const { user, pass } = getSmtpConfig();
  const { senderEmail } = getConfig();
  return Boolean(user && pass && senderEmail);
}

/** True when Brevo is configured enough to attempt sends. */
export function isBrevoConfigured(): boolean {
  const { apiKey, senderEmail } = getConfig();
  if (!senderEmail) return false;
  return Boolean(apiKey) || isSmtpConfigured();
}

export type BrevoProbe = {
  reachable: boolean;
  via: "rest" | "smtp" | "none";
  blockReason?: string;
};

/** Live check — REST account call, then SMTP if REST is IP-blocked. */
export async function probeBrevo(): Promise<BrevoProbe> {
  const { apiKey } = getConfig();
  if (apiKey) {
    try {
      const res = await fetch("https://api.brevo.com/v3/account", {
        headers: brevoHeaders(apiKey),
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) return { reachable: true, via: "rest" };
      const errText = await res.text().catch(() => "");
      if (!isUnrecognizedIpError(res.status, errText) || !isSmtpConfigured()) {
        return {
          reachable: false,
          via: "none",
          blockReason: describeBrevoError(res.status, errText),
        };
      }
    } catch (err) {
      if (!isSmtpConfigured()) {
        return {
          reachable: false,
          via: "none",
          blockReason:
            err instanceof Error ? err.message : "Could not reach mail provider.",
        };
      }
    }
  }

  if (isSmtpConfigured()) {
    return { reachable: true, via: "smtp" };
  }

  return {
    reachable: false,
    via: "none",
    blockReason: "Brevo is not configured.",
  };
}

async function sendViaSmtp(
  input: SendEmailInput,
  recipients: EmailAddress[],
): Promise<SendEmailResult> {
  const { senderEmail, senderName } = getConfig();
  const smtp = getSmtpConfig();
  if (!smtp.user || !smtp.pass || !senderEmail) {
    return {
      ok: true,
      skipped: true,
      reason: "Brevo SMTP not configured (BREVO_SMTP_USER / BREVO_SMTP_KEY)",
    };
  }

  const nodemailer = (await import("nodemailer")).default;
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: { user: smtp.user, pass: smtp.pass },
    connectionTimeout: 15_000,
    socketTimeout: 20_000,
  });

  try {
    const info = await transporter.sendMail({
      from: { name: senderName, address: senderEmail },
      to: recipients.map((row) =>
        row.name
          ? { name: row.name, address: row.email }
          : row.email,
      ),
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "SMTP error";
    console.error("[brevo] smtp send failed", message);
    return { ok: false, error: `SMTP: ${message}` };
  } finally {
    transporter.close();
  }
}

function normalizeRecipients(
  to: EmailAddress | EmailAddress[],
): EmailAddress[] {
  const list = Array.isArray(to) ? to : [to];
  return list
    .map((r) => ({
      email: r.email.trim().toLowerCase(),
      name: r.name?.trim() || undefined,
    }))
    .filter((r) => r.email.includes("@"));
}

/**
 * Send one transactional email via Brevo.
 * Never throws — returns { ok: false } or { ok: true, skipped: true }.
 */
export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const { apiKey, senderEmail, senderName } = getConfig();
  if (!senderEmail || (!apiKey && !isSmtpConfigured())) {
    return {
      ok: true,
      skipped: true,
      reason: "Brevo not configured (BREVO_API_KEY / BREVO_SENDER_EMAIL)",
    };
  }

  const recipients = normalizeRecipients(input.to);
  if (recipients.length === 0) {
    return { ok: false, error: "No valid recipients." };
  }

  const body: Record<string, unknown> = {
    sender: { email: senderEmail, name: senderName },
    to: recipients.map((r) =>
      r.name ? { email: r.email, name: r.name } : { email: r.email },
    ),
    subject: input.subject,
    htmlContent: input.html,
  };

  if (input.text) body.textContent = input.text;
  if (input.tags?.length) body.tags = input.tags;
  if (input.replyTo?.email) {
    body.replyTo = {
      email: input.replyTo.email,
      ...(input.replyTo.name ? { name: input.replyTo.name } : {}),
    };
  }

  if (!apiKey && isSmtpConfigured()) {
    return sendViaSmtp(input, recipients);
  }

  try {
    const payload = JSON.stringify(body);
    // Explicit timeout so Next.js does not bind this to the incoming
    // request AbortSignal (that aborts as soon as the HTTP response is sent).
    let res = await fetch(BREVO_SEND_URL, {
      method: "POST",
      headers: brevoHeaders(apiKey),
      body: payload,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      let errText = await res.text().catch(() => "");
      const blockedIp = parseUnrecognizedIp(errText);
      if (blockedIp && isUnrecognizedIpError(res.status, errText)) {
        const granted = await authorizeUnrecognizedIp(apiKey, blockedIp);
        if (granted) {
          res = await fetch(BREVO_SEND_URL, {
            method: "POST",
            headers: brevoHeaders(apiKey),
            body: payload,
            cache: "no-store",
            signal: AbortSignal.timeout(20_000),
          });
          if (res.ok) {
            const retried = (await res.json().catch(() => ({}))) as {
              messageId?: string;
            };
            return { ok: true, messageId: retried.messageId };
          }
          errText = await res.text().catch(() => errText);
        }
        if (isSmtpConfigured()) {
          console.warn("[brevo] REST IP blocked — falling back to SMTP");
          return sendViaSmtp(input, recipients);
        }
      }

      console.error("[brevo] send failed", res.status, errText.slice(0, 500));
      return {
        ok: false,
        error: describeBrevoError(res.status, errText || res.statusText),
      };
    }

    const data = (await res.json().catch(() => ({}))) as {
      messageId?: string;
    };
    return { ok: true, messageId: data.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    console.error("[brevo] send error", message);
    if (isSmtpConfigured()) {
      console.warn("[brevo] REST failed — falling back to SMTP");
      return sendViaSmtp(input, recipients);
    }
    return { ok: false, error: message };
  }
}

/** Fire-and-forget: never blocks the caller. */
export function sendEmailBackground(input: SendEmailInput): void {
  void sendEmail(input).then((result) => {
    if (!result.ok) {
      console.error("[brevo] background send failed", result.error);
    } else if (result.skipped) {
      // Dev / unconfigured — quiet
    }
  });
}

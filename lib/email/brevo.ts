/**
 * Brevo (Sendinblue) transactional email client.
 *
 * Env:
 *   BREVO_API_KEY        — required to send
 *   BREVO_SENDER_EMAIL   — verified sender in Brevo (required)
 *   BREVO_SENDER_NAME    — optional display name (default: Cubicle)
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

/** True when Brevo is configured enough to attempt sends. */
export function isBrevoConfigured(): boolean {
  const { apiKey, senderEmail } = getConfig();
  return Boolean(apiKey && senderEmail);
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
  if (!apiKey || !senderEmail) {
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

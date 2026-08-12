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
    const res = await fetch(BREVO_SEND_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[brevo] send failed", res.status, errText.slice(0, 500));
      return {
        ok: false,
        error: `Brevo ${res.status}: ${errText.slice(0, 200) || res.statusText}`,
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

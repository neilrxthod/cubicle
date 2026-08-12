/**
 * Server-side email delivery policy.
 * Local: blocked by default; optional single sink address when testing.
 * Production: always normal multi-recipient delivery; never honor client sinks.
 */

import { isLocalDevRuntime } from "@/lib/data/durability";

export type LocalEmailSink = {
  enabled?: boolean;
  testEmail?: string;
};

export type DeliveryPlan =
  | { mode: "production" }
  | { mode: "blocked"; reason: string }
  | { mode: "local_sink"; email: string };

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Resolve how this request may send mail.
 * Client-supplied sink is only accepted when the *server* is in local runtime.
 */
export function resolveDeliveryPlan(sink?: LocalEmailSink | null): DeliveryPlan {
  if (!isLocalDevRuntime()) {
    return { mode: "production" };
  }

  // Local default: never hit Brevo (even if API keys exist in .env.local).
  if (!sink || sink.enabled !== true) {
    return {
      mode: "blocked",
      reason:
        "Local email testing is off. Enable it in Settings → Email (local testing).",
    };
  }

  const email = String(sink.testEmail ?? "")
    .trim()
    .toLowerCase();
  if (!isValidEmail(email)) {
    return {
      mode: "blocked",
      reason: "Set a valid test email in Settings → Email (local testing).",
    };
  }

  return { mode: "local_sink", email };
}

/** Prefix subjects in local sink mode so inboxes are easy to spot. */
export function localSubject(subject: string): string {
  if (subject.startsWith("[Cubicle local]")) return subject;
  return `[Cubicle local] ${subject}`;
}

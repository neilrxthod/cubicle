"use server";

import {
  isBrevoConfigured,
  isSmtpConfigured,
  probeBrevo,
} from "@/lib/email/brevo";
import { isLocalDevRuntime } from "@/lib/data/durability";

export type EmailDispatchStatus = {
  configured: boolean;
  live: boolean;
  mode: "production" | "local";
  reachable: boolean;
  via: "rest" | "smtp" | "none";
  blockReason?: string;
};

/** Safe to show in Settings — no keys, no recipient lists. */
export async function getEmailDispatchStatus(): Promise<EmailDispatchStatus> {
  const configured = isBrevoConfigured();
  const local = isLocalDevRuntime();
  if (local) {
    return {
      configured,
      live: false,
      mode: "local",
      reachable: configured,
      via: isSmtpConfigured() ? "smtp" : configured ? "rest" : "none",
    };
  }

  let probe: {
    reachable: boolean;
    via: "rest" | "smtp" | "none";
    blockReason?: string;
  } = { reachable: false, via: "none" };

  if (configured) {
    try {
      probe = await probeBrevo();
    } catch {
      probe = {
        reachable: false,
        via: "none",
        blockReason:
          "Could not reach Brevo from this host. If Authorized IP blocking is on for API keys, turn it off, or add BREVO_SMTP_USER and BREVO_SMTP_KEY.",
      };
    }
  }

  return {
    configured,
    live: configured && probe.reachable,
    mode: "production",
    reachable: probe.reachable,
    via: probe.via,
    blockReason: probe.blockReason,
  };
}

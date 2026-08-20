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

  const probe = configured
    ? await probeBrevo()
    : { reachable: false, via: "none" as const, blockReason: undefined };

  return {
    configured,
    live: configured && probe.reachable,
    mode: "production",
    reachable: probe.reachable,
    via: probe.via,
    blockReason: probe.blockReason,
  };
}

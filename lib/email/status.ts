"use server";

import { isBrevoConfigured } from "@/lib/email/brevo";
import { isLocalDevRuntime } from "@/lib/data/durability";

export type EmailDispatchStatus = {
  configured: boolean;
  live: boolean;
  mode: "production" | "local";
};

/** Safe to show in Settings — no keys, no recipient lists. */
export async function getEmailDispatchStatus(): Promise<EmailDispatchStatus> {
  const configured = isBrevoConfigured();
  const local = isLocalDevRuntime();
  return {
    configured,
    live: configured && !local,
    mode: local ? "local" : "production",
  };
}

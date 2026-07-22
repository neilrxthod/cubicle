/**
 * Data durability rules for Cubicle.
 *
 * School data (bookings, carts, issues, staff, restrictions) lives in
 * **Supabase Postgres**. Vercel deploys only ship application code — they
 * never wipe or migrate the database by themselves.
 *
 * This module enforces:
 * 1. Production / hosted deploys MUST use remote Supabase (never browser demo seed).
 * 2. Local demo mode is allowed only outside production hosts.
 * 3. A clear message when env is misconfigured so operators don't silently lose trust.
 */

import { isSupabaseConfigured } from "@/lib/supabase/env";

/** Hosted production site (custom domain or Vercel production). */
export function isProductionDeploy(): boolean {
  if (typeof process === "undefined") return false;

  const vercelEnv =
    process.env.NEXT_PUBLIC_VERCEL_ENV?.trim() ||
    process.env.VERCEL_ENV?.trim();
  if (vercelEnv === "production") return true;

  // Explicit operator override (set on Vercel Production env).
  if (process.env.NEXT_PUBLIC_CUBICLE_REQUIRE_REMOTE === "true") return true;

  // Browser: real school domain never runs as localStorage demo.
  if (typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();
    if (
      host === "mycubicle.app" ||
      host === "www.mycubicle.app" ||
      host.endsWith(".vercel.app")
    ) {
      return true;
    }
  }

  return false;
}

/**
 * True when the app may use in-browser seed/localStorage as the source of truth.
 * Never true on production hosts or when Supabase is configured.
 */
export function isLocalDemoMode(): boolean {
  if (isSupabaseConfigured()) return false;
  if (isProductionDeploy()) return false;
  return true;
}

/**
 * Remote Postgres is required: either Supabase is configured, or we're on a
 * production host that must not fall back to demo data.
 */
export function requiresRemoteDatabase(): boolean {
  return isSupabaseConfigured() || isProductionDeploy();
}

/**
 * Production misconfiguration: live host without Supabase keys.
 * The UI should hard-stop (no fake seed data).
 */
export function isRemoteRequiredButMissing(): boolean {
  return isProductionDeploy() && !isSupabaseConfigured();
}

export const REMOTE_REQUIRED_MESSAGE =
  "Cubicle is running in production mode but Supabase is not configured. " +
  "Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and " +
  "SUPABASE_SERVICE_ROLE_KEY on Vercel, then redeploy. " +
  "School data is never stored in the app deploy — only in Supabase.";

export const LOCAL_WRITE_BLOCKED_MESSAGE =
  "This environment requires the Supabase database. Local demo writes are disabled so real school data cannot be confused with temporary browser storage.";

/**
 * Guard for any mutation that would only touch localStorage in demo mode.
 * Returns an error string if the write must not proceed locally.
 */
export function localWriteBlockReason(): string | null {
  if (isSupabaseConfigured()) return null;
  if (isProductionDeploy()) return LOCAL_WRITE_BLOCKED_MESSAGE;
  return null;
}

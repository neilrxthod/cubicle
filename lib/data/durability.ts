/**
 * Data durability rules for Cubicle.
 *
 * School data (bookings, carts, issues, staff, restrictions) lives in
 * **Supabase Postgres** in production. Vercel deploys only ship application
 * code — they never wipe or migrate the database by themselves.
 *
 * This module enforces:
 * 1. Production / hosted deploys MUST use remote Supabase (never browser demo seed).
 * 2. Local development is isolated by default — even if production Supabase
 *    keys are present in `.env.local` — so adding carts / bookings locally
 *    cannot mutate the live school database.
 * 3. A clear message when env is misconfigured so operators don't silently lose trust.
 */

import { isProductionHostname } from "@/lib/site";
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
    if (isProductionHostname(window.location.hostname)) {
      return true;
    }
  }

  return false;
}

function isLoopbackHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host.endsWith(".local")
  );
}

/**
 * Developer machine / localhost — not a Vercel deploy and not a production host.
 *
 * Used to keep platform writes (carts, bookings, issues, …) out of the live
 * school database while coding on a laptop.
 *
 * Server and client agree on `next dev` via NODE_ENV. Loopback hostnames cover
 * `next start` in the browser. Production/Vercel never count as local.
 */
export function isLocalDevRuntime(): boolean {
  if (typeof process === "undefined") return false;

  // Explicit overrides (same on server + client via NEXT_PUBLIC_*).
  const cubicleEnv = process.env.NEXT_PUBLIC_CUBICLE_ENV?.trim().toLowerCase();
  if (cubicleEnv === "production") return false;
  if (cubicleEnv === "local" || cubicleEnv === "development") return true;

  // Never treat Vercel production/preview as "local".
  const vercelEnv =
    process.env.NEXT_PUBLIC_VERCEL_ENV?.trim() ||
    process.env.VERCEL_ENV?.trim();
  if (vercelEnv === "production" || vercelEnv === "preview") return false;

  // Production hosts / REQUIRE_REMOTE always remote when keys exist.
  if (isProductionDeploy()) return false;

  // Next.js `next dev` (SSR + client).
  if (process.env.NODE_ENV === "development") return true;

  // Browser on a loopback host (covers `next start` on a laptop).
  if (typeof window !== "undefined" && isLoopbackHostname(window.location.hostname)) {
    return true;
  }

  return false;
}

/**
 * Opt-in: allow platform data to use the Supabase project from env while local.
 *
 * Prefer a **staging** Supabase project. Do not enable this with production
 * keys unless you intentionally want live school data on your laptop.
 */
export function allowRemoteInLocalDev(): boolean {
  return process.env.NEXT_PUBLIC_CUBICLE_USE_REMOTE_IN_DEV === "true";
}

/**
 * True when carts / bookings / issues / staff ops should go to Supabase Postgres.
 *
 * Local dev defaults to **false** even if `.env.local` contains production
 * Supabase keys, so developer experiments stay on this machine.
 */
export function isRemotePlatformEnabled(): boolean {
  if (!isSupabaseConfigured()) return false;
  if (isLocalDevRuntime() && !allowRemoteInLocalDev()) return false;
  return true;
}

/**
 * True when the app may use in-browser localStorage as the source of truth
 * for platform data (carts, bookings, etc.).
 *
 * Never true on production hosts. True on local isolation even when Supabase
 * keys exist for Google auth testing.
 */
export function isLocalDemoMode(): boolean {
  if (isProductionDeploy()) return false;
  if (isRemotePlatformEnabled()) return false;
  return true;
}

/**
 * Remote Postgres is required for this runtime (production hosts, or local
 * with remote explicitly enabled).
 */
export function requiresRemoteDatabase(): boolean {
  return isRemotePlatformEnabled() || isProductionDeploy();
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

export const LOCAL_SANDBOX_BANNER =
  "Local development sandbox — carts, bookings, and other changes stay on this machine and do not update the school production database.";

/**
 * Guard for any mutation that would only touch localStorage in demo mode.
 * Returns an error string if the write must not proceed locally.
 */
export function localWriteBlockReason(): string | null {
  // Remote path handles persistence; local mutate is unused when remote is on.
  if (isRemotePlatformEnabled()) return null;
  if (isProductionDeploy()) return LOCAL_WRITE_BLOCKED_MESSAGE;
  return null;
}

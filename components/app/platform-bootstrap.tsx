"use client";

import { useEffect, useState } from "react";
import { hydratePlatformFromSupabase } from "@/lib/actions";
import { syncSessionFromPlatformState } from "@/lib/auth/session-live";
import {
  getPlatformSnapshot,
  isPlatformRemoteHydrated,
  markPlatformRemoteHydrated,
  subscribePlatform,
} from "@/lib/data/platform-store";
import {
  isLocalDemoMode,
  isRemotePlatformEnabled,
  isRemoteRequiredButMissing,
  REMOTE_REQUIRED_MESSAGE,
  requiresRemoteDatabase,
} from "@/lib/data/durability";
import { subscribePlatformRealtime } from "@/lib/supabase/realtime";
import { RemoteRequiredScreen } from "@/components/app/remote-required-screen";

/** Safety-net poll while the tab is visible (missed Realtime events / sleep). */
const VISIBLE_POLL_MS = 18_000;

/**
 * Loads platform data from Supabase, then keeps it live via Realtime.
 *
 * Production: always remote Postgres. Code deploys never wipe that data.
 * Local dev: isolated browser sandbox by default (even if production keys are
 * in `.env.local`) so developer carts/bookings never hit the school database.
 *
 * Multi-client sync (two browsers, two teachers, phone + laptop):
 * 1. Supabase Realtime postgres_changes → full store refresh
 * 2. Tab focus / visibility / online → immediate refresh
 * 3. Visible-tab poll as a fallback if a websocket event is dropped
 * 4. localStorage + BroadcastChannel for same-browser multi-tab
 */
export function PlatformBootstrap({
  children,
}: {
  children: React.ReactNode;
}) {
  const remoteMissing = isRemoteRequiredButMissing();
  const remoteEnabled = isRemotePlatformEnabled();

  const [ready, setReady] = useState(
    () =>
      remoteMissing ||
      isLocalDemoMode() ||
      !remoteEnabled ||
      isPlatformRemoteHydrated(),
  );
  const [error, setError] = useState("");

  // Initial load from Postgres (async only — sync ready cases are in useState above)
  // Browser cache epoch resets are handled inside platform-store (local only).
  useEffect(() => {
    if (remoteMissing || !remoteEnabled || isPlatformRemoteHydrated()) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const result = await hydratePlatformFromSupabase();
      if (cancelled) return;
      if (!result.ok) {
        // Never fall back to seed when remote is required — empty/wrong data
        // would look like "everything disappeared" after a deploy.
        setError(
          result.error ?? "Could not load school data from the database.",
        );
        setReady(true);
        return;
      }
      markPlatformRemoteHydrated(true);
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [remoteMissing, remoteEnabled]);

  // Live multi-client sync: Realtime + visibility/online + light poll.
  useEffect(() => {
    if (!remoteEnabled || !ready || error || remoteMissing) return;

    let inFlight = false;
    let queued = false;
    let disposed = false;

    const refresh = () => {
      if (disposed) return;
      if (inFlight) {
        queued = true;
        return;
      }
      inFlight = true;
      void hydratePlatformFromSupabase()
        .then((result) => {
          if (disposed) return;
          if (result.ok) {
            syncSessionFromPlatformState(getPlatformSnapshot());
          }
        })
        .finally(() => {
          inFlight = false;
          if (queued) {
            queued = false;
            refresh();
          }
        });
    };

    const unsubscribeRealtime = subscribePlatformRealtime(refresh);

    const onVisibleOrFocus = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      refresh();
    };

    const onOnline = () => refresh();

    document.addEventListener("visibilitychange", onVisibleOrFocus);
    window.addEventListener("focus", onVisibleOrFocus);
    window.addEventListener("online", onOnline);

    // While this tab is visible, periodically re-pull so a dropped Realtime
    // event never leaves boards stale for long (other devices still feel live).
    const pollId = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, VISIBLE_POLL_MS);

    return () => {
      disposed = true;
      unsubscribeRealtime();
      document.removeEventListener("visibilitychange", onVisibleOrFocus);
      window.removeEventListener("focus", onVisibleOrFocus);
      window.removeEventListener("online", onOnline);
      window.clearInterval(pollId);
    };
  }, [ready, error, remoteEnabled, remoteMissing]);

  // Keep header/session name in lockstep with platform store (Realtime + local).
  useEffect(() => {
    if (!ready) return;
    syncSessionFromPlatformState(getPlatformSnapshot());
    return subscribePlatform(() => {
      syncSessionFromPlatformState(getPlatformSnapshot());
    });
  }, [ready]);

  if (remoteMissing) {
    return <RemoteRequiredScreen message={REMOTE_REQUIRED_MESSAGE} />;
  }

  if (!ready) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-[#f6f6f7]">
        <div className="flex flex-col items-center gap-3">
          <div className="size-6 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
          <p className="text-sm text-neutral-500">
            {requiresRemoteDatabase()
              ? "Loading school data…"
              : "Starting Cubicle…"}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-[#f6f6f7] px-6 text-center">
        <p className="text-[15px] font-medium text-neutral-900">
          Could not load Cubicle data
        </p>
        <p className="max-w-md text-sm text-neutral-500">{error}</p>
        <p className="max-w-md text-[12px] text-neutral-400">
          Your data is still in the database. This is a connection or
          permissions issue — not a wipe from deploying code.
        </p>
        <button
          type="button"
          className="mt-2 rounded-lg bg-neutral-950 px-4 py-2 text-sm font-medium text-white"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

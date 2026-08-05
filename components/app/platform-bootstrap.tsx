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
  isRemoteRequiredButMissing,
  REMOTE_REQUIRED_MESSAGE,
  requiresRemoteDatabase,
} from "@/lib/data/durability";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { subscribePlatformRealtime } from "@/lib/supabase/realtime";
import { RemoteRequiredScreen } from "@/components/app/remote-required-screen";

/**
 * Loads platform data from Supabase, then keeps it live via Realtime.
 *
 * Production: always remote Postgres. Code deploys never wipe that data.
 * Local demo: empty localStorage scaffold when Supabase env is absent and not
 * on a production host.
 */
export function PlatformBootstrap({
  children,
}: {
  children: React.ReactNode;
}) {
  const remoteMissing = isRemoteRequiredButMissing();
  const remoteEnabled = isSupabaseConfigured();

  const [ready, setReady] = useState(
    () =>
      remoteMissing ||
      isLocalDemoMode() ||
      !remoteEnabled ||
      isPlatformRemoteHydrated(),
  );
  const [error, setError] = useState("");

  // Initial load from Postgres (async only — sync ready cases are in useState above)
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
        setError(result.error ?? "Could not load school data from the database.");
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

  // Live updates: any change to bookings/carts/issues/profiles refreshes shared store
  useEffect(() => {
    if (!remoteEnabled || !ready || error || remoteMissing) return;

    let inFlight = false;
    let queued = false;

    const refresh = () => {
      if (inFlight) {
        queued = true;
        return;
      }
      inFlight = true;
      void hydratePlatformFromSupabase()
        .then((result) => {
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

    const unsubscribe = subscribePlatformRealtime(refresh);

    return unsubscribe;
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

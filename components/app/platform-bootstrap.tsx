"use client";

import { useEffect, useState } from "react";
import { hydratePlatformFromSupabase } from "@/lib/actions";
import {
  isPlatformRemoteHydrated,
  markPlatformRemoteHydrated,
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
 * Local demo: seed + localStorage only when Supabase env is absent and not
 * on a production host.
 */
export function PlatformBootstrap({
  children,
}: {
  children: React.ReactNode;
}) {
  const remoteMissing = isRemoteRequiredButMissing();
  const useRemote = isSupabaseConfigured();

  const [ready, setReady] = useState(
    () =>
      remoteMissing ||
      isLocalDemoMode() ||
      (useRemote && isPlatformRemoteHydrated()),
  );
  const [error, setError] = useState("");

  // Initial load from Postgres
  useEffect(() => {
    if (remoteMissing) {
      setReady(true);
      return;
    }
    if (!useRemote) {
      // Safe local demo only
      setReady(true);
      return;
    }
    if (isPlatformRemoteHydrated()) {
      setReady(true);
      return;
    }

    let cancelled = false;

    (async () => {
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
  }, [remoteMissing, useRemote]);

  // Live updates: any change to bookings/carts/issues refreshes shared store
  useEffect(() => {
    if (!useRemote || !ready || error || remoteMissing) return;

    const unsubscribe = subscribePlatformRealtime(() => {
      void hydratePlatformFromSupabase();
    });

    return unsubscribe;
  }, [ready, error, useRemote, remoteMissing]);

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

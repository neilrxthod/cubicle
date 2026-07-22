"use client";

import { useEffect, useState } from "react";
import { hydratePlatformFromSupabase } from "@/lib/actions";
import {
  isPlatformRemoteHydrated,
  markPlatformRemoteHydrated,
} from "@/lib/data/platform-store";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Loads carts/bookings/issues from Supabase once the user is authenticated.
 * Falls back to local seed data when Supabase is not configured.
 */
export function PlatformBootstrap({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(
    () => !isSupabaseConfigured() || isPlatformRemoteHydrated(),
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured()) {
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
        setError(result.error ?? "Could not load school data.");
        setReady(true);
        return;
      }
      markPlatformRemoteHydrated(true);
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-[#f6f6f7]">
        <div className="flex flex-col items-center gap-3">
          <div className="size-6 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
          <p className="text-sm text-neutral-500">Loading school data…</p>
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

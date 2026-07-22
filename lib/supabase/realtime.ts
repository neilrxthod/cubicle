import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const REALTIME_TABLES = [
  "bookings",
  "carts",
  "issues",
  "slot_restrictions",
  "swap_requests",
  "profiles",
  "booking_policy",
  "allowed_emails",
] as const;

/**
 * Subscribe to live Postgres changes for school platform tables.
 * Calls `onChange` (debounced) whenever any table mutates so all open
 * dashboards stay in sync without a full page reload.
 *
 * Returns an unsubscribe function.
 */
export function subscribePlatformRealtime(onChange: () => void): () => void {
  if (!isSupabaseConfigured()) {
    return () => {};
  }

  const supabase = createClient();
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const schedule = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    // Short debounce: batch multi-row writes / rapid clicks into one refresh.
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      onChange();
    }, 120);
  };

  let channel = supabase.channel("cubicle-platform-v1");

  for (const table of REALTIME_TABLES) {
    channel = channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      () => schedule(),
    );
  }

  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      // Optional: one refresh on connect to catch anything missed while offline.
      schedule();
    }
  });

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    void supabase.removeChannel(channel);
  };
}

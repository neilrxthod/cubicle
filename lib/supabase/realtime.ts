import type { RealtimeChannel } from "@supabase/supabase-js";
import { isRemotePlatformEnabled } from "@/lib/data/durability";
import { createClient } from "@/lib/supabase/client";

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

/** Batch multi-row writes into one refresh — keep low so peers feel near-instant. */
const DEBOUNCE_MS = 80;
const RECONNECT_BASE_MS = 400;
const RECONNECT_MAX_MS = 5_000;

/**
 * Subscribe to live Postgres changes for school platform tables.
 * Calls `onChange` (debounced) whenever any table mutates so all open
 * dashboards stay in sync without a full page reload.
 *
 * Handles reconnect on channel errors / auth refresh. Returns unsubscribe.
 */
export function subscribePlatformRealtime(onChange: () => void): () => void {
  // Do not open a live channel to production Postgres from an isolated local sandbox.
  if (!isRemotePlatformEnabled() || typeof window === "undefined") {
    return () => {};
  }

  const supabase = createClient();
  let disposed = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempt = 0;
  let channel: RealtimeChannel | null = null;
  let connecting = false;

  const schedule = () => {
    if (disposed) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    // Batch multi-row writes / rapid clicks into one full refresh.
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      if (!disposed) onChange();
    }, DEBOUNCE_MS);
  };

  const clearReconnect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const teardownChannel = () => {
    if (!channel) return;
    const ch = channel;
    channel = null;
    void supabase.removeChannel(ch);
  };

  const scheduleReconnect = () => {
    if (disposed) return;
    clearReconnect();
    const delay = Math.min(
      RECONNECT_MAX_MS,
      RECONNECT_BASE_MS * 2 ** reconnectAttempt,
    );
    reconnectAttempt += 1;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void connect();
    }, delay);
  };

  const connect = async () => {
    if (disposed || connecting) return;
    connecting = true;
    clearReconnect();
    teardownChannel();

    try {
      // Ensure Realtime has a JWT so RLS-filtered postgres_changes fire.
      // Prefer getSession (no network) — a dead refresh token would only spam
      // AuthApiError if we forced a refresh here.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (disposed) return;
      if (!session) {
        // No usable auth — skip channel until SIGNED_IN reconnects.
        return;
      }

      const name = `cubicle-platform-${
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      }`;

      let next = supabase.channel(name, {
        config: { broadcast: { self: false } },
      });

      for (const table of REALTIME_TABLES) {
        next = next.on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          () => schedule(),
        );
      }

      channel = next;
      channel.subscribe((status) => {
        if (disposed) return;

        if (status === "SUBSCRIBED") {
          reconnectAttempt = 0;
          // Catch anything that landed while we were offline / connecting.
          schedule();
          return;
        }

        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          scheduleReconnect();
        }
      });
    } catch (err) {
      console.warn("[cubicle] realtime connect failed:", err);
      scheduleReconnect();
    } finally {
      connecting = false;
    }
  };

  void connect();

  // Re-bind channel when a user signs in. Token refresh is handled by the
  // client; we only re-pull data so we don't thrash the websocket.
  const {
    data: { subscription: authSub },
  } = supabase.auth.onAuthStateChange((event) => {
    if (disposed) return;
    if (event === "SIGNED_IN") {
      reconnectAttempt = 0;
      void connect();
      return;
    }
    if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
      schedule();
      return;
    }
    if (event === "SIGNED_OUT") {
      teardownChannel();
      clearReconnect();
    }
  });

  // Browser came back online — resubscribe + refresh.
  const onOnline = () => {
    reconnectAttempt = 0;
    void connect();
    schedule();
  };
  window.addEventListener("online", onOnline);

  return () => {
    disposed = true;
    if (debounceTimer) clearTimeout(debounceTimer);
    clearReconnect();
    window.removeEventListener("online", onOnline);
    authSub.unsubscribe();
    teardownChannel();
  };
}

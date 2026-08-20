import type { RealtimeChannel } from "@supabase/supabase-js";
import { isRemotePlatformEnabled } from "@/lib/data/durability";
import { applyRealtimePostgresChange } from "@/lib/supabase/realtime-apply";
import { createClient } from "@/lib/supabase/client";

/** Full hydrate after a burst of writes. Patches apply immediately (0ms). */
const DEBOUNCE_MS = 200;
const RECONNECT_BASE_MS = 400;
const RECONNECT_MAX_MS = 5_000;
const PLATFORM_TOPIC = "cubicle-platform";

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
  let connectGen = 0;

  const schedule = () => {
    if (disposed) return;
    if (debounceTimer) clearTimeout(debounceTimer);
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
    const gen = ++connectGen;
    clearReconnect();
    teardownChannel();

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (disposed || gen !== connectGen) return;
      if (!session) {
        return;
      }

      // One schema binding — a full hydrate follows any public change.
      // Per-table bindings used to desync from the server list and throw
      // "mismatch between server and client bindings", which then treated
      // CLOSED as a reconnect and overflowed Phoenix filterBindings.
      const next = supabase
        .channel(PLATFORM_TOPIC)
        .on("postgres_changes", { event: "*", schema: "public" }, (payload) => {
          if (disposed || gen !== connectGen) return;
          applyRealtimePostgresChange(payload);
          schedule();
        });

      channel = next;
      next.subscribe((status) => {
        if (disposed || gen !== connectGen) return;

        if (status === "SUBSCRIBED") {
          reconnectAttempt = 0;
          schedule();
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          scheduleReconnect();
          return;
        }

        // CLOSED after we already replaced this channel is teardown — ignore.
        if (status === "CLOSED" && channel === next) {
          channel = null;
          scheduleReconnect();
        }
      });
    } catch (err) {
      console.warn("[cubicle] realtime connect failed:", err);
      if (gen === connectGen) scheduleReconnect();
    } finally {
      connecting = false;
    }
  };

  void connect();

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
      connectGen += 1;
      teardownChannel();
      clearReconnect();
    }
  });

  const onOnline = () => {
    reconnectAttempt = 0;
    void connect();
    schedule();
  };
  window.addEventListener("online", onOnline);

  return () => {
    disposed = true;
    connectGen += 1;
    if (debounceTimer) clearTimeout(debounceTimer);
    clearReconnect();
    window.removeEventListener("online", onOnline);
    authSub.unsubscribe();
    teardownChannel();
  };
}

/**
 * Who is currently signed in (this browser, other tabs, optional remote).
 * Staff directory and share pickers use this for the green presence dot.
 */

import { useSyncExternalStore } from "react";
import { getLocalDemoPreviewOnlineIds } from "@/lib/auth/local-demo";
import { getSessionSnapshot } from "@/lib/auth/session";
import { isRemotePlatformEnabled } from "@/lib/data/durability";

const STORAGE_KEY = "cubicle_presence_v1";
const CHANGE_EVENT = "cubicle_presence_change";
const CHANNEL = "cubicle_presence_bc";
const HEARTBEAT_MS = 12_000;
const STALE_MS = 40_000;

type PresenceMap = Record<string, number>;

const remoteOnline = new Set<string>();
const listeners = new Set<() => void>();

function now() {
  return Date.now();
}

function readMap(): PresenceMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PresenceMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(map: PresenceMap) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // quota / private mode
  }
}

function prune(map: PresenceMap, at = now()): PresenceMap {
  const next: PresenceMap = {};
  for (const [id, atMs] of Object.entries(map)) {
    if (typeof atMs === "number" && at - atMs < STALE_MS) next[id] = atMs;
  }
  return next;
}

function notify() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CHANGE_EVENT));
    try {
      const bc = new BroadcastChannel(CHANNEL);
      bc.postMessage({ t: now() });
      bc.close();
    } catch {
      // ignore
    }
  }
  for (const fn of listeners) fn();
}

function touch(userId: string) {
  if (!userId) return;
  const map = prune(readMap());
  map[userId] = now();
  writeMap(map);
  notify();
}

function drop(userId: string) {
  if (!userId) return;
  const map = prune(readMap());
  delete map[userId];
  writeMap(map);
  notify();
}

let cachedIds = new Set<string>();
let cachedKey = "";

export function getOnlineUserIds(): Set<string> {
  const ids = new Set<string>();
  const session = getSessionSnapshot();
  if (session?.id) ids.add(session.id);

  const at = now();
  for (const [id, atMs] of Object.entries(prune(readMap(), at))) {
    if (at - atMs < STALE_MS) ids.add(id);
  }
  for (const id of remoteOnline) ids.add(id);
  for (const id of getLocalDemoPreviewOnlineIds()) ids.add(id);

  const key = [...ids].sort().join("\0");
  if (key === cachedKey) return cachedIds;
  cachedKey = key;
  cachedIds = ids;
  return cachedIds;
}

export function isUserOnline(userId: string | undefined | null): boolean {
  if (!userId) return false;
  return getOnlineUserIds().has(userId);
}

export function useOnlineUserIds(): Set<string> {
  return useSyncExternalStore(
    subscribePresence,
    getOnlineUserIds,
    () => new Set<string>(),
  );
}

export function subscribePresence(onChange: () => void): () => void {
  listeners.add(onChange);
  if (typeof window === "undefined") {
    return () => {
      listeners.delete(onChange);
    };
  }

  const onLocal = () => onChange();
  window.addEventListener(CHANGE_EVENT, onLocal);
  window.addEventListener("storage", onLocal);

  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel(CHANNEL);
    bc.onmessage = () => onChange();
  } catch {
    bc = null;
  }

  const poll = window.setInterval(onChange, HEARTBEAT_MS);

  return () => {
    listeners.delete(onChange);
    window.removeEventListener(CHANGE_EVENT, onLocal);
    window.removeEventListener("storage", onLocal);
    window.clearInterval(poll);
    try {
      bc?.close();
    } catch {
      // ignore
    }
  };
}

/**
 * Mark this signed-in user as online until the tab unloads.
 * Safe to call often — one interval per mount.
 */
export function startPresence(userId: string): () => void {
  if (typeof window === "undefined" || !userId) return () => {};

  touch(userId);
  const beat = window.setInterval(() => touch(userId), HEARTBEAT_MS);

  const onVisible = () => {
    if (document.visibilityState === "visible") touch(userId);
  };
  document.addEventListener("visibilitychange", onVisible);

  let stopRemote = () => {};
  if (isRemotePlatformEnabled()) {
    stopRemote = startRemotePresence(userId);
  }

  const onLeave = () => drop(userId);
  window.addEventListener("pagehide", onLeave);

  return () => {
    window.clearInterval(beat);
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("pagehide", onLeave);
    stopRemote();
    drop(userId);
  };
}

function startRemotePresence(userId: string): () => void {
  let cancelled = false;
  let channel: { unsubscribe: () => void } | null = null;

  void (async () => {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const ch = supabase.channel("staff-online", {
        config: { presence: { key: userId } },
      });
      ch.on("presence", { event: "sync" }, () => {
        remoteOnline.clear();
        const state = ch.presenceState() as Record<string, unknown[]>;
        for (const key of Object.keys(state)) remoteOnline.add(key);
        notify();
      });
      ch.subscribe((status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") {
          void ch.track({ at: now() });
        }
      });
      if (cancelled) {
        void supabase.removeChannel(ch);
        return;
      }
      channel = {
        unsubscribe: () => {
          void supabase.removeChannel(ch);
        },
      };
    } catch {
      // Presence is best-effort.
    }
  })();

  return () => {
    cancelled = true;
    channel?.unsubscribe();
    remoteOnline.delete(userId);
  };
}

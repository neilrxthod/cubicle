/**
 * Who is signed in right now — this tab, other Cubicle tabs, and remote peers.
 * Staff directory and share pickers use this for the presence dot:
 * green = viewing Cubicle, yellow = Cubicle open but another tab is focused,
 * none = left / closed. You never see your own dot — only other people do.
 */

import { useSyncExternalStore } from "react";
import { getSessionSnapshot, subscribeToSession } from "@/lib/auth/session";
import { isRemotePlatformEnabled } from "@/lib/data/durability";

const STORAGE_KEY = "cubicle_presence_v2";
const TAB_KEY = "cubicle_presence_tab";
const CHANGE_EVENT = "cubicle_presence_change";
const CHANNEL = "cubicle_presence_bc";

/** Keep-alive + UI prune — dots must flip in under a second. */
const HEARTBEAT_MS = 400;
const STALE_MS = 900;
const STORE_KEEP_MS = 3_000;
const UI_TICK_MS = 250;

export type PresenceStatus = "online" | "away" | "offline";
type LiveStatus = "online" | "away";

type PresenceEntry = {
  userId: string;
  tabId: string;
  status: LiveStatus;
  at: number;
};

type PresenceMap = Record<string, PresenceEntry>;

const remoteByUser = new Map<string, PresenceEntry[]>();
const listeners = new Set<() => void>();

let selfLive: PresenceEntry | null = null;
let memoryTabId = "";
let cachedStatuses = new Map<string, PresenceStatus>();
let cachedKey = "";
let cachedOnline = new Set<string>();
let cachedOnlineKey = "";
let broadcast: BroadcastChannel | null = null;

function now() {
  return Date.now();
}

function entryKey(userId: string, tabId: string) {
  return `${userId}::${tabId}`;
}

function getTabId(): string {
  if (memoryTabId) return memoryTabId;
  const fallback = () =>
    globalThis.crypto?.randomUUID?.() ??
    `t-${Math.random().toString(36).slice(2, 10)}`;
  if (typeof window === "undefined") {
    memoryTabId = fallback();
    return memoryTabId;
  }
  try {
    const existing = sessionStorage.getItem(TAB_KEY);
    if (existing) {
      memoryTabId = existing;
      return existing;
    }
    const id = fallback();
    sessionStorage.setItem(TAB_KEY, id);
    memoryTabId = id;
    return id;
  } catch {
    memoryTabId = fallback();
    return memoryTabId;
  }
}

function isLiveStatus(value: unknown): value is LiveStatus {
  return value === "online" || value === "away";
}

function parseEntry(key: string, value: unknown): PresenceEntry | null {
  if (value && typeof value === "object") {
    const row = value as Partial<PresenceEntry>;
    if (
      typeof row.userId === "string" &&
      typeof row.tabId === "string" &&
      isLiveStatus(row.status) &&
      typeof row.at === "number"
    ) {
      return {
        userId: row.userId,
        tabId: row.tabId,
        status: row.status,
        at: row.at,
      };
    }
  }
  // v1 leftover: { [userId]: timestamp }
  if (typeof value === "number" && !key.includes("::")) {
    return {
      userId: key,
      tabId: "legacy",
      status: "online",
      at: value,
    };
  }
  return null;
}

function readMap(): PresenceMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};
    const next: PresenceMap = {};
    for (const [key, value] of Object.entries(parsed)) {
      const entry = parseEntry(key, value);
      if (entry) next[entryKey(entry.userId, entry.tabId)] = entry;
    }
    return next;
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

function prune(map: PresenceMap, maxAge = STORE_KEEP_MS, at = now()): PresenceMap {
  const next: PresenceMap = {};
  for (const [key, entry] of Object.entries(map)) {
    if (entry && at - entry.at < maxAge) next[key] = entry;
  }
  return next;
}

function getBroadcast(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (broadcast) return broadcast;
  try {
    broadcast = new BroadcastChannel(CHANNEL);
  } catch {
    broadcast = null;
  }
  return broadcast;
}

function notifyListeners() {
  for (const fn of listeners) fn();
}

let notifyPending = false;

/** Never flush into an in-progress React render (Next Router, etc.). */
function scheduleNotify() {
  if (notifyPending) return;
  notifyPending = true;
  const flush = () => {
    notifyPending = false;
    notifyListeners();
  };
  if (typeof queueMicrotask === "function") {
    queueMicrotask(flush);
  } else {
    setTimeout(flush, 0);
  }
}

function notify() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CHANGE_EVENT));
    try {
      getBroadcast()?.postMessage({ t: now() });
    } catch {
      // ignore
    }
  }
  scheduleNotify();
}

let sharedAttached = false;
let sharedBc: BroadcastChannel | null = null;
let sharedPoll = 0;
let unsubSession: (() => void) | null = null;

function attachShared() {
  if (sharedAttached || typeof window === "undefined") return;
  sharedAttached = true;
  window.addEventListener("storage", scheduleNotify);
  try {
    sharedBc = new BroadcastChannel(CHANNEL);
    sharedBc.onmessage = () => scheduleNotify();
  } catch {
    sharedBc = null;
  }
  sharedPoll = window.setInterval(scheduleNotify, UI_TICK_MS);
  unsubSession = subscribeToSession(scheduleNotify);
}

function detachShared() {
  if (!sharedAttached || typeof window === "undefined") return;
  sharedAttached = false;
  window.removeEventListener("storage", scheduleNotify);
  window.clearInterval(sharedPoll);
  sharedPoll = 0;
  try {
    sharedBc?.close();
  } catch {
    // ignore
  }
  sharedBc = null;
  unsubSession?.();
  unsubSession = null;
}

function upsertLocal(entry: PresenceEntry) {
  const map = prune(readMap());
  map[entryKey(entry.userId, entry.tabId)] = entry;
  writeMap(map);
}

function removeLocal(userId: string, tabId: string) {
  const map = readMap();
  delete map[entryKey(userId, tabId)];
  writeMap(map);
}

function liveStatusFromDocument(): LiveStatus {
  if (typeof document === "undefined") return "online";
  return document.visibilityState === "visible" ? "online" : "away";
}

function rank(status: PresenceStatus): number {
  if (status === "online") return 2;
  if (status === "away") return 1;
  return 0;
}

function collectEntries(): PresenceEntry[] {
  const byKey = new Map<string, PresenceEntry>();
  for (const entry of Object.values(readMap())) {
    byKey.set(entryKey(entry.userId, entry.tabId), entry);
  }
  for (const entries of remoteByUser.values()) {
    for (const entry of entries) {
      byKey.set(entryKey(entry.userId, entry.tabId), entry);
    }
  }
  if (selfLive) {
    byKey.set(entryKey(selfLive.userId, selfLive.tabId), selfLive);
  }
  return [...byKey.values()];
}

function reduceStatuses(entries: PresenceEntry[], at = now()): Map<string, PresenceStatus> {
  const best = new Map<string, PresenceStatus>();
  for (const entry of entries) {
    if (at - entry.at >= STALE_MS) continue;
    const prev = best.get(entry.userId) ?? "offline";
    if (rank(entry.status) > rank(prev)) {
      best.set(entry.userId, entry.status);
    }
  }
  return best;
}

function snapshotKey(map: Map<string, PresenceStatus>): string {
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, status]) => `${id}:${status}`)
    .join("\0");
}

export function getPresenceMap(): Map<string, PresenceStatus> {
  const next = reduceStatuses(collectEntries());
  // Never render your own status — peers still see it on their clients.
  const selfId = getSessionSnapshot()?.id;
  if (selfId) next.delete(selfId);
  const key = `${selfId ?? ""}|${snapshotKey(next)}`;
  if (key === cachedKey) return cachedStatuses;
  cachedKey = key;
  cachedStatuses = next;
  return cachedStatuses;
}

export function getUserPresence(
  userId: string | undefined | null,
): PresenceStatus {
  if (!userId) return "offline";
  return getPresenceMap().get(userId) ?? "offline";
}

export function getOnlineUserIds(): Set<string> {
  const ids = new Set<string>();
  for (const [id, status] of getPresenceMap()) {
    if (status === "online") ids.add(id);
  }
  const key = [...ids].sort().join("\0");
  if (key === cachedOnlineKey) return cachedOnline;
  cachedOnlineKey = key;
  cachedOnline = ids;
  return cachedOnline;
}

export function isUserOnline(userId: string | undefined | null): boolean {
  return getUserPresence(userId) === "online";
}

export function usePresenceMap(): Map<string, PresenceStatus> {
  return useSyncExternalStore(
    subscribePresence,
    getPresenceMap,
    () => cachedStatuses,
  );
}

export function useUserPresence(
  userId: string | undefined | null,
): PresenceStatus {
  const map = usePresenceMap();
  if (!userId) return "offline";
  return map.get(userId) ?? "offline";
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
  attachShared();
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) detachShared();
  };
}

/**
 * Mark this signed-in user online while the Cubicle tab is visible,
 * away while another tab is focused, and gone when the tab closes.
 */
export function startPresence(userId: string): () => void {
  if (typeof window === "undefined" || !userId) return () => {};

  const tabId = getTabId();
  const remote = isRemotePlatformEnabled()
    ? startRemotePresence(userId, tabId)
    : { publish: () => {}, stop: () => {} };

  const publish = (status: LiveStatus) => {
    const entry: PresenceEntry = {
      userId,
      tabId,
      status,
      at: now(),
    };
    selfLive = entry;
    upsertLocal(entry);
    remote.publish(status);
    notify();
  };

  const beat = () => publish(liveStatusFromDocument());
  const drop = () => {
    if (selfLive?.userId === userId && selfLive.tabId === tabId) {
      selfLive = null;
    }
    removeLocal(userId, tabId);
    notify();
  };

  beat();
  const interval = window.setInterval(beat, HEARTBEAT_MS);

  const onVisibility = () => beat();
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("focus", onVisibility);
  window.addEventListener("pageshow", onVisibility);

  const onPageHide = (event: PageTransitionEvent) => {
    if (event.persisted) {
      publish("away");
      return;
    }
    drop();
    remote.stop();
  };
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("beforeunload", drop);

  return () => {
    window.clearInterval(interval);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("focus", onVisibility);
    window.removeEventListener("pageshow", onVisibility);
    window.removeEventListener("pagehide", onPageHide);
    window.removeEventListener("beforeunload", drop);
    remote.stop();
    drop();
  };
}

function parseRemoteMeta(
  userId: string,
  meta: unknown,
  index: number,
): PresenceEntry | null {
  if (!meta || typeof meta !== "object") return null;
  const row = meta as {
    status?: unknown;
    at?: unknown;
    tab?: unknown;
  };
  const status = isLiveStatus(row.status) ? row.status : "online";
  const at = typeof row.at === "number" ? row.at : now();
  const tabId =
    typeof row.tab === "string" && row.tab
      ? row.tab
      : `remote-${index}`;
  return { userId, tabId, status, at };
}

function startRemotePresence(
  userId: string,
  tabId: string,
): {
  publish: (status: LiveStatus) => void;
  stop: () => void;
} {
  let cancelled = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let channel: {
    track: (payload: Record<string, unknown>) => Promise<unknown>;
    untrack: () => Promise<unknown>;
    unsubscribe: () => void;
  } | null = null;
  let lastStatus: LiveStatus = liveStatusFromDocument();

  const applyRemoteState = (state: Record<string, unknown[]>) => {
    remoteByUser.clear();
    for (const [id, metas] of Object.entries(state)) {
      const entries: PresenceEntry[] = [];
      (metas ?? []).forEach((meta, index) => {
        const entry = parseRemoteMeta(id, meta, index);
        if (entry) entries.push(entry);
      });
      if (entries.length > 0) remoteByUser.set(id, entries);
    }
    notify();
  };

  const teardown = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (channel) {
      void channel.untrack();
      channel.unsubscribe();
      channel = null;
    }
  };

  let connectGen = 0;

  const connect = () => {
    if (cancelled) return;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    const gen = ++connectGen;
    teardown();
    void (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const ch = supabase.channel("staff-online", {
          config: { presence: { key: userId } },
        });

        const sync = () => {
          if (cancelled || gen !== connectGen) return;
          const snapshot = ch.presenceState() as Record<string, unknown[]>;
          queueMicrotask(() => {
            if (cancelled || gen !== connectGen) return;
            applyRemoteState(snapshot);
          });
        };
        // Sync already runs after join/leave diffs — extra listeners re-enter
        // Phoenix trigger() and can overflow filterBindings.
        ch.on("presence", { event: "sync" }, sync);

        ch.subscribe((status) => {
          if (cancelled || gen !== connectGen) return;
          if (status === "SUBSCRIBED") {
            void ch.track({
              status: lastStatus,
              at: now(),
              tab: tabId,
            });
            return;
          }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            if (!reconnectTimer) {
              reconnectTimer = setTimeout(connect, 400);
            }
            return;
          }
          if (status === "CLOSED" && channel) {
            channel = null;
            if (!reconnectTimer) {
              reconnectTimer = setTimeout(connect, 400);
            }
          }
        });

        if (cancelled || gen !== connectGen) {
          void supabase.removeChannel(ch);
          return;
        }

        channel = {
          track: (payload) => ch.track(payload),
          untrack: () => ch.untrack(),
          unsubscribe: () => {
            void supabase.removeChannel(ch);
          },
        };
      } catch {
        if (cancelled || gen !== connectGen) return;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connect, 800);
      }
    })();
  };

  connect();

  return {
    publish(status) {
      lastStatus = status;
      if (!channel) return;
      void channel.track({ status, at: now(), tab: tabId });
    },
    stop() {
      cancelled = true;
      connectGen += 1;
      teardown();
      const remaining = (remoteByUser.get(userId) ?? []).filter(
        (entry) => entry.tabId !== tabId,
      );
      if (remaining.length > 0) remoteByUser.set(userId, remaining);
      else remoteByUser.delete(userId);
      notify();
    },
  };
}


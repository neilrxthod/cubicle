"use client";

import { useSyncExternalStore } from "react";
import {
  isRemotePlatformEnabled,
  localWriteBlockReason,
} from "@/lib/data/durability";
import type {
  Booking,
  BookingPolicy,
  Cart,
  Issue,
  PlatformState,
  SlotRestriction,
  SwapRequest,
  User,
} from "@/lib/types";

/**
 * Browser cache only. Source of truth in production is Supabase Postgres.
 * Re-deploying the Next.js app never clears Supabase — only this local cache.
 *
 * Local sandbox uses a separate key namespace so a hydrated production mirror
 * never mixes with developer experiments.
 */
/**
 * Bump on official school go-live / when every browser must drop cached
 * carts, bookings, and locks. Epoch 13 = official high school empty go-live.
 */
const PLATFORM_EPOCH = 13;
const CHANGE_EVENT = "cubicle_platform_change";

function storageNamespace(): "remote" | "local" {
  return isRemotePlatformEnabled() ? "remote" : "local";
}

function platformStorageKey(): string {
  return storageNamespace() === "remote"
    ? `cubicle_platform_v${PLATFORM_EPOCH}`
    : `cubicle_platform_local_v${PLATFORM_EPOCH}`;
}

function platformEpochKey(): string {
  return storageNamespace() === "remote"
    ? "cubicle_platform_epoch"
    : "cubicle_platform_local_epoch";
}

/** Same-origin multi-tab sync (pairs with Realtime for other browsers/devices). */
function platformBroadcastChannel(): string {
  return storageNamespace() === "remote"
    ? `cubicle_platform_bc_v${PLATFORM_EPOCH}`
    : `cubicle_platform_local_bc_v${PLATFORM_EPOCH}`;
}

/**
 * Official empty platform — no carts, bookings, issues, or restrictions.
 * Admins add inventory from Admin → Inventory. Staff come from Google allowlist.
 */
function emptyState(): PlatformState {
  return {
    carts: [],
    bookings: [],
    issues: [],
    users: [],
    slotRestrictions: [],
    bookingPolicy: {
      maxAdvanceDays: 14,
      maxSlotsPerTeacherPerDay: 5,
    },
    swapRequests: [],
  };
}

/** @deprecated name kept for useSyncExternalStore getServerSnapshot */
function seed(): PlatformState {
  return emptyState();
}

let memory: PlatformState | null = null;
let cachedRaw: string | null | undefined;

function clone<T>(value: T): T {
  return structuredClone(value);
}

/**
 * One-time (per epoch) wipe of browser platform cache so locked ADMIN slots
 * and old demo carts cannot reappear after a hard refresh.
 */
function ensureFreshEpoch() {
  if (typeof window === "undefined") return;
  try {
    const epochKey = platformEpochKey();
    const storageKey = platformStorageKey();
    const current = localStorage.getItem(epochKey);
    if (current === String(PLATFORM_EPOCH)) return;
    // Only wipe keys for this namespace — never destroy the other mode's cache.
    localStorage.removeItem(storageKey);
    localStorage.removeItem(epochKey);
    memory = emptyState();
    const raw = JSON.stringify(memory);
    cachedRaw = raw;
    localStorage.setItem(storageKey, raw);
    localStorage.setItem(epochKey, String(PLATFORM_EPOCH));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // ignore
  }
}

function read(): PlatformState {
  if (typeof window === "undefined") return seed();
  ensureFreshEpoch();
  const raw = localStorage.getItem(platformStorageKey());
  if (raw === cachedRaw && memory) return memory;
  cachedRaw = raw;
  if (!raw) {
    memory = emptyState();
    return memory;
  }
  try {
    memory = JSON.parse(raw) as PlatformState;
    // Guard: never keep half-broken shapes
    if (!memory || !Array.isArray(memory.carts)) {
      memory = emptyState();
    }
    if (!Array.isArray(memory.slotRestrictions)) memory.slotRestrictions = [];
    if (!Array.isArray(memory.bookings)) memory.bookings = [];
    if (!Array.isArray(memory.issues)) memory.issues = [];
    if (!Array.isArray(memory.users)) memory.users = [];
    if (!Array.isArray(memory.swapRequests)) memory.swapRequests = [];
    if (!memory.bookingPolicy) {
      memory.bookingPolicy = {
        maxAdvanceDays: 14,
        maxSlotsPerTeacherPerDay: 5,
      };
    } else {
      if (typeof memory.bookingPolicy.maxAdvanceDays !== "number") {
        memory.bookingPolicy.maxAdvanceDays = 14;
      }
      if (typeof memory.bookingPolicy.maxSlotsPerTeacherPerDay !== "number") {
        memory.bookingPolicy.maxSlotsPerTeacherPerDay = 5;
      }
    }
    return memory;
  } catch {
    memory = emptyState();
    return memory;
  }
}

function invalidateMemoryCache() {
  memory = null;
  cachedRaw = null;
}

function notifyPlatformPeers() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CHANGE_EVENT));
  try {
    const bc = new BroadcastChannel(platformBroadcastChannel());
    bc.postMessage({
      type: "platform",
      epoch: PLATFORM_EPOCH,
      ns: storageNamespace(),
      t: Date.now(),
    });
    bc.close();
  } catch {
    // BroadcastChannel unavailable (older browsers / restricted contexts)
  }
}

function write(next: PlatformState, serialized?: string) {
  const raw = serialized ?? JSON.stringify(next);
  if (raw === cachedRaw) {
    memory = next;
    return;
  }
  memory = next;
  cachedRaw = raw;
  if (typeof window !== "undefined") {
    localStorage.setItem(platformStorageKey(), raw);
    localStorage.setItem(platformEpochKey(), String(PLATFORM_EPOCH));
    notifyPlatformPeers();
  }
}

function update(mutator: (draft: PlatformState) => void) {
  const draft = clone(read());
  mutator(draft);
  write(draft);
}

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function subscribePlatform(onChange: () => void) {
  if (typeof window === "undefined") return () => {};

  const onLocal = () => onChange();
  const storageKey = platformStorageKey();
  const epochKey = platformEpochKey();

  // Other tabs wrote localStorage — drop memory cache so we re-read.
  const onStorage = (event: StorageEvent) => {
    if (
      event.key === null ||
      event.key === storageKey ||
      event.key === epochKey
    ) {
      invalidateMemoryCache();
      onChange();
    }
  };

  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel(platformBroadcastChannel());
    bc.onmessage = () => {
      invalidateMemoryCache();
      onChange();
    };
  } catch {
    bc = null;
  }

  window.addEventListener(CHANGE_EVENT, onLocal);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onLocal);
    window.removeEventListener("storage", onStorage);
    try {
      bc?.close();
    } catch {
      // ignore
    }
  };
}

export function getPlatformSnapshot(): PlatformState {
  return read();
}

export function usePlatformStore(): PlatformState {
  return useSyncExternalStore(subscribePlatform, getPlatformSnapshot, seed);
}

export function getState() {
  return read();
}

/**
 * Local-demo mutations only. No-ops when production requires Supabase so a
 * misconfigured deploy cannot pretend to save school data in the browser.
 */
export function mutate(mutator: (draft: PlatformState) => void) {
  const blocked = localWriteBlockReason();
  if (blocked) {
    console.error("[cubicle] local mutate blocked:", blocked);
    return;
  }
  update(mutator);
}

/**
 * Replace client cache after a successful Supabase fetch.
 * Does not write to Postgres — only mirrors remote state for the UI.
 */
export function replaceState(next: PlatformState) {
  const raw = JSON.stringify(next);
  if (raw === cachedRaw) {
    memory = next;
    return;
  }
  write(next, raw);
}

/** Force in-memory + localStorage to a completely empty platform. */
export function forceEmptyPlatformState() {
  memory = emptyState();
  cachedRaw = null;
  if (typeof window !== "undefined") {
    try {
      const storageKey = platformStorageKey();
      const epochKey = platformEpochKey();
      localStorage.removeItem(storageKey);
      localStorage.removeItem(epochKey);
      const raw = JSON.stringify(memory);
      cachedRaw = raw;
      localStorage.setItem(storageKey, raw);
      localStorage.setItem(epochKey, String(PLATFORM_EPOCH));
    } catch {
      // ignore
    }
    notifyPlatformPeers();
  }
}

/**
 * Drop the browser cache only (never touches Supabase).
 * Used after sign-out so the next session hydrates fresh from Postgres.
 * Only clears the active namespace (remote cache vs local sandbox).
 */
export function clearPlatformBrowserCache() {
  memory = null;
  cachedRaw = null;
  remoteHydrated = false;
  if (typeof window !== "undefined") {
    try {
      const storageKey = platformStorageKey();
      const epochKey = platformEpochKey();
      localStorage.removeItem(storageKey);
      // Keep epoch so we don't re-run destructive empty write loops unnecessarily
      localStorage.setItem(epochKey, String(PLATFORM_EPOCH));
    } catch {
      // ignore quota / private mode
    }
    notifyPlatformPeers();
  }
}

let remoteHydrated = false;

export function isPlatformRemoteHydrated() {
  return remoteHydrated;
}

export function markPlatformRemoteHydrated(value = true) {
  remoteHydrated = value;
}

export function makeId(prefix: string) {
  return uid(prefix);
}

export type {
  Booking,
  BookingPolicy,
  Cart,
  Issue,
  PlatformState,
  SlotRestriction,
  SwapRequest,
  User,
};

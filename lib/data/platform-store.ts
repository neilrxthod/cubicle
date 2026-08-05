"use client";

import { useSyncExternalStore } from "react";
import { localWriteBlockReason } from "@/lib/data/durability";
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
 */
/**
 * Bump on official school go-live / when every browser must drop cached
 * carts, bookings, and locks. Epoch 13 = official high school empty go-live.
 */
const PLATFORM_EPOCH = 13;
const STORAGE_KEY = `cubicle_platform_v${PLATFORM_EPOCH}`;
const EPOCH_KEY = "cubicle_platform_epoch";
const CHANGE_EVENT = "cubicle_platform_change";

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
    bookingPolicy: { maxAdvanceDays: 14 },
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

function purgeAllPlatformLocalKeys() {
  if (typeof window === "undefined") return;
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      // Platform cache only — never Google session / auth cookies
      if (
        k.startsWith("cubicle_platform") ||
        k.startsWith("cubicle_fresh_start")
      ) {
        doomed.push(k);
      }
    }
    for (const k of doomed) localStorage.removeItem(k);
  } catch {
    // ignore quota / private mode
  }
}

/**
 * One-time (per epoch) wipe of browser platform cache so locked ADMIN slots
 * and old demo carts cannot reappear after a hard refresh.
 */
function ensureFreshEpoch() {
  if (typeof window === "undefined") return;
  try {
    const current = localStorage.getItem(EPOCH_KEY);
    if (current === String(PLATFORM_EPOCH)) return;
    purgeAllPlatformLocalKeys();
    memory = emptyState();
    const raw = JSON.stringify(memory);
    cachedRaw = raw;
    localStorage.setItem(STORAGE_KEY, raw);
    localStorage.setItem(EPOCH_KEY, String(PLATFORM_EPOCH));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // ignore
  }
}

function read(): PlatformState {
  if (typeof window === "undefined") return seed();
  ensureFreshEpoch();
  const raw = localStorage.getItem(STORAGE_KEY);
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
    if (!memory.bookingPolicy) memory.bookingPolicy = { maxAdvanceDays: 14 };
    return memory;
  } catch {
    memory = emptyState();
    return memory;
  }
}

function write(next: PlatformState) {
  memory = next;
  const raw = JSON.stringify(next);
  cachedRaw = raw;
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, raw);
    localStorage.setItem(EPOCH_KEY, String(PLATFORM_EPOCH));
    window.dispatchEvent(new Event(CHANGE_EVENT));
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
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
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
  write(next);
}

/** Force in-memory + localStorage to a completely empty platform. */
export function forceEmptyPlatformState() {
  memory = emptyState();
  cachedRaw = null;
  if (typeof window !== "undefined") {
    try {
      purgeAllPlatformLocalKeys();
      const raw = JSON.stringify(memory);
      cachedRaw = raw;
      localStorage.setItem(STORAGE_KEY, raw);
      localStorage.setItem(EPOCH_KEY, String(PLATFORM_EPOCH));
    } catch {
      // ignore
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

/**
 * Drop the browser cache only (never touches Supabase).
 * Used after sign-out so the next session hydrates fresh from Postgres.
 */
export function clearPlatformBrowserCache() {
  memory = null;
  cachedRaw = null;
  remoteHydrated = false;
  if (typeof window !== "undefined") {
    try {
      purgeAllPlatformLocalKeys();
      // Keep epoch so we don't re-run destructive empty write loops unnecessarily
      localStorage.setItem(EPOCH_KEY, String(PLATFORM_EPOCH));
    } catch {
      // ignore quota / private mode
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
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

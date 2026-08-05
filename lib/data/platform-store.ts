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
/** Bump when seed shape changes so clients drop stale browser caches. */
const STORAGE_KEY = "cubicle_platform_v9";
const CHANGE_EVENT = "cubicle_platform_change";

/**
 * Fresh empty platform — no carts, staff, bookings, or restrictions.
 * Local demo and SSR fall back to this until Supabase (or local edits) populate state.
 */
function seed(): PlatformState {
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

let memory: PlatformState | null = null;
let cachedRaw: string | null | undefined;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function read(): PlatformState {
  if (typeof window === "undefined") return seed();
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw && memory) return memory;
  cachedRaw = raw;
  if (!raw) {
    memory = seed();
    return memory;
  }
  try {
    memory = JSON.parse(raw) as PlatformState;
    return memory;
  } catch {
    memory = seed();
    return memory;
  }
}

function write(next: PlatformState) {
  memory = next;
  const raw = JSON.stringify(next);
  cachedRaw = raw;
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, raw);
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
      localStorage.removeItem(STORAGE_KEY);
      // Drop legacy seed caches so a hard refresh cannot restore demo data.
      for (let i = 1; i < 9; i++) {
        localStorage.removeItem(`cubicle_platform_v${i}`);
      }
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

"use client";

import { useSyncExternalStore } from "react";
import { format } from "date-fns";
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
const STORAGE_KEY = "cubicle_platform_v3";
const CHANGE_EVENT = "cubicle_platform_change";

function today() {
  return format(new Date(), "yyyy-MM-dd");
}

/** 22 school laptop carts — each with a distinct name + home location. */
const SEED_CARTS: Cart[] = [
  { id: "cart-01", name: "Oak", status: "active", laptopCount: 30, location: "Library" },
  { id: "cart-02", name: "Maple", status: "active", laptopCount: 28, location: "Room 102" },
  { id: "cart-03", name: "Cedar", status: "active", laptopCount: 32, location: "Room 118" },
  { id: "cart-04", name: "Pine", status: "active", laptopCount: 30, location: "Room 204" },
  { id: "cart-05", name: "Birch", status: "active", laptopCount: 24, location: "Room 210" },
  { id: "cart-06", name: "Willow", status: "active", laptopCount: 30, location: "Room 215" },
  { id: "cart-07", name: "Aspen", status: "active", laptopCount: 28, location: "Science wing" },
  { id: "cart-08", name: "Redwood", status: "active", laptopCount: 32, location: "Lab 1" },
  { id: "cart-09", name: "Elm", status: "active", laptopCount: 30, location: "Lab 2" },
  { id: "cart-10", name: "Spruce", status: "maintenance", laptopCount: 26, location: "Media center" },
  { id: "cart-11", name: "Juniper", status: "active", laptopCount: 30, location: "Room 301" },
  { id: "cart-12", name: "Cypress", status: "active", laptopCount: 28, location: "Room 308" },
  { id: "cart-13", name: "Poplar", status: "active", laptopCount: 30, location: "Room 312" },
  { id: "cart-14", name: "Hickory", status: "active", laptopCount: 24, location: "Room 320" },
  { id: "cart-15", name: "Sycamore", status: "active", laptopCount: 32, location: "English wing" },
  { id: "cart-16", name: "Magnolia", status: "active", laptopCount: 30, location: "Room 405" },
  { id: "cart-17", name: "Laurel", status: "active", laptopCount: 28, location: "Room 412" },
  { id: "cart-18", name: "Alder", status: "active", laptopCount: 30, location: "Math wing" },
  { id: "cart-19", name: "Beech", status: "active", laptopCount: 26, location: "Room 508" },
  { id: "cart-20", name: "Hemlock", status: "active", laptopCount: 30, location: "Room 514" },
  { id: "cart-21", name: "Fir", status: "active", laptopCount: 28, location: "IT closet" },
  { id: "cart-22", name: "Yew", status: "active", laptopCount: 24, location: "Counseling suite" },
];

function seed(): PlatformState {
  const d = today();
  return {
    carts: SEED_CARTS,
    bookings: [
      {
        id: "bk-1",
        cartId: "cart-01",
        date: d,
        period: "P2",
        teacherId: "teacher-1",
        teacherName: "Sarah Chen",
        className: "Biology 10",
        subject: "Science",
        createdAt: new Date().toISOString(),
      },
      {
        id: "bk-2",
        cartId: "cart-04",
        date: d,
        period: "P3",
        teacherId: "teacher-2",
        teacherName: "Maria Lopez",
        className: "English 9",
        createdAt: new Date().toISOString(),
      },
      {
        id: "bk-3",
        cartId: "cart-08",
        date: d,
        period: "P5",
        teacherId: "teacher-3",
        teacherName: "James Park",
        className: "World History",
        createdAt: new Date().toISOString(),
      },
    ],
    issues: [
      {
        id: "iss-1",
        cartId: "cart-10",
        description: "Three laptops won't charge in slots 4, 11, and 18.",
        severity: "high",
        status: "open",
        reportedById: "teacher-1",
        reporterName: "Sarah Chen",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
      },
      {
        id: "iss-2",
        cartId: "cart-04",
        description: "Wobbly front-left wheel — hard to roll between floors.",
        severity: "low",
        status: "open",
        reportedById: "teacher-2",
        reporterName: "Maria Lopez",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
      },
      {
        id: "iss-3",
        cartId: "cart-08",
        description: "Two keyboards missing letters; students couldn't log in on time.",
        severity: "medium",
        status: "resolved",
        reportedById: "teacher-3",
        reporterName: "James Park",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
      },
    ],
    users: [
      {
        id: "teacher-1",
        name: "Sarah Chen",
        email: "teacher@cubicle.edu",
        role: "teacher",
        password: "teacher123",
        employmentType: "permanent",
        allowlisted: true,
      },
      {
        id: "teacher-2",
        name: "Maria Lopez",
        email: "m.lopez@cubicle.edu",
        role: "teacher",
        password: "demo1234",
        employmentType: "substitute",
        allowlisted: true,
      },
      {
        id: "teacher-3",
        name: "James Park",
        email: "j.park@cubicle.edu",
        role: "teacher",
        password: "demo1234",
        employmentType: "temporary",
        allowlisted: true,
      },
      {
        id: "admin-1",
        name: "James Wilson",
        email: "admin@cubicle.edu",
        role: "admin",
        password: "admin123",
        employmentType: "permanent",
        allowlisted: true,
      },
    ],
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

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
const STORAGE_KEY = "cubicle_platform_v8";
const CHANGE_EVENT = "cubicle_platform_change";

/** 22 school laptop carts — catalog only (no demo bookings/issues). */
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
  { id: "cart-10", name: "Spruce", status: "active", laptopCount: 26, location: "Media center" },
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

/**
 * Local demo scaffold: cart catalog + demo staff accounts only.
 * Bookings, issues, and restrictions start empty.
 */
function seed(): PlatformState {
  return {
    carts: SEED_CARTS,
    bookings: [],
    issues: [],
    users: [
      {
        id: "teacher-1",
        name: "Sarah Chen",
        email: "teacher@cubicle.edu",
        role: "teacher",
        password: "teacher123",
        title: "Science teacher",
        department: "Science",
        phone: "306-555-0142",
        employmentType: "permanent",
        allowlisted: true,
      },
      {
        id: "teacher-2",
        name: "Maria Lopez",
        email: "m.lopez@cubicle.edu",
        role: "teacher",
        password: "demo1234",
        title: "ELA teacher",
        department: "English",
        employmentType: "substitute",
        allowlisted: true,
      },
      {
        id: "teacher-3",
        name: "James Park",
        email: "j.park@cubicle.edu",
        role: "teacher",
        password: "demo1234",
        title: "History teacher",
        department: "Social Studies",
        employmentType: "temporary",
        allowlisted: true,
      },
      {
        id: "teacher-4",
        name: "Priya Shah",
        email: "p.shah@cubicle.edu",
        role: "teacher",
        password: "demo1234",
        title: "Math teacher",
        department: "Mathematics",
        employmentType: "permanent",
        allowlisted: true,
      },
      {
        id: "teacher-5",
        name: "Chris Ortiz",
        email: "c.ortiz@cubicle.edu",
        role: "teacher",
        password: "demo1234",
        title: "English teacher",
        department: "English",
        employmentType: "permanent",
        allowlisted: true,
      },
      {
        id: "teacher-6",
        name: "David Kim",
        email: "d.kim@cubicle.edu",
        role: "teacher",
        password: "demo1234",
        title: "Science teacher",
        department: "Science",
        employmentType: "permanent",
        allowlisted: true,
      },
      {
        id: "teacher-7",
        name: "Aisha Rahman",
        email: "a.rahman@cubicle.edu",
        role: "teacher",
        password: "demo1234",
        title: "CTE / Computer Science",
        department: "Career & Tech",
        employmentType: "permanent",
        allowlisted: true,
      },
      {
        id: "teacher-8",
        name: "Nina Brooks",
        email: "n.brooks@cubicle.edu",
        role: "teacher",
        password: "demo1234",
        title: "French teacher",
        department: "Languages",
        employmentType: "permanent",
        allowlisted: true,
      },
      {
        id: "teacher-9",
        name: "Tom Bradley",
        email: "t.bradley@cubicle.edu",
        role: "teacher",
        password: "demo1234",
        title: "PE / Health",
        department: "Physical Education",
        employmentType: "permanent",
        allowlisted: true,
      },
      {
        id: "teacher-10",
        name: "Elena Vasquez",
        email: "e.vasquez@cubicle.edu",
        role: "teacher",
        password: "demo1234",
        title: "Spanish teacher",
        department: "Languages",
        employmentType: "permanent",
        allowlisted: true,
      },
      {
        id: "teacher-11",
        name: "Robert Hale",
        email: "r.hale@cubicle.edu",
        role: "teacher",
        password: "demo1234",
        title: "Business teacher",
        department: "Career & Tech",
        employmentType: "permanent",
        allowlisted: true,
      },
      {
        id: "teacher-12",
        name: "Grace Liu",
        email: "g.liu@cubicle.edu",
        role: "teacher",
        password: "demo1234",
        title: "School counselor",
        department: "Student Services",
        employmentType: "permanent",
        allowlisted: true,
      },
      {
        id: "admin-1",
        name: "James Wilson",
        email: "admin@cubicle.edu",
        role: "admin",
        password: "admin123",
        title: "IT coordinator",
        department: "Technology",
        phone: "306-555-0100",
        employmentType: "permanent",
        allowlisted: true,
      },
      {
        id: "admin-2",
        name: "Patricia Okonkwo",
        email: "p.okonkwo@cubicle.edu",
        role: "admin",
        password: "demo1234",
        title: "Library media specialist",
        department: "Library",
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

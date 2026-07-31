import type { Booking, Cart, CubicleState, Issue } from "./types";

export const SEED_CARTS: Cart[] = [
  {
    id: "cart-a",
    name: "Cart A",
    location: "Library",
    laptopCount: 30,
    status: "ready",
  },
  {
    id: "cart-b",
    name: "Cart B",
    location: "Room 204",
    laptopCount: 28,
    status: "ready",
  },
  {
    id: "cart-c",
    name: "Cart C",
    location: "Science wing",
    laptopCount: 32,
    status: "ready",
  },
  {
    id: "cart-d",
    name: "Cart D",
    location: "Media center",
    laptopCount: 24,
    status: "maintenance",
    notes: "Battery pack replacement scheduled",
  },
  {
    id: "cart-e",
    name: "Cart E",
    location: "Room 118",
    laptopCount: 30,
    status: "ready",
  },
  {
    id: "cart-f",
    name: "Cart F",
    location: "IT closet",
    laptopCount: 20,
    status: "offline",
    notes: "Waiting on charger order",
  },
];

/** Bookings start empty — no demo reservations on the board. */
export const SEED_BOOKINGS: Booking[] = [];

export const SEED_ISSUES: Issue[] = [
  {
    id: "iss-1",
    cartId: "cart-d",
    reportedByEmail: "teacher@cubicle.edu",
    reportedByName: "Sarah Chen",
    title: "Three laptops won't charge",
    description:
      "Slots 4, 11, and 18 show no charge light. Class lost 15 minutes.",
    severity: "high",
    status: "open",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
  {
    id: "iss-2",
    cartId: "cart-b",
    reportedByEmail: "m.lopez@cubicle.edu",
    reportedByName: "Maria Lopez",
    title: "Wobbly wheel on left side",
    description: "Hard to move between floors. Still usable.",
    severity: "low",
    status: "in_progress",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
  },
];

export function createSeedState(): CubicleState {
  return {
    version: 1,
    carts: SEED_CARTS,
    bookings: SEED_BOOKINGS,
    issues: SEED_ISSUES,
  };
}

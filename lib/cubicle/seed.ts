import type { Booking, Cart, CubicleState, Issue } from "./types";
import { toDateKey } from "./periods";

const today = toDateKey();

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

export const SEED_BOOKINGS: Booking[] = [
  {
    id: "bk-1",
    cartId: "cart-a",
    date: today,
    periodId: 2,
    teacherEmail: "teacher@cubicle.edu",
    teacherName: "Sarah Chen",
    className: "Biology 10",
    room: "214",
    status: "confirmed",
    createdAt: new Date().toISOString(),
  },
  {
    id: "bk-2",
    cartId: "cart-b",
    date: today,
    periodId: 3,
    teacherEmail: "m.lopez@cubicle.edu",
    teacherName: "Maria Lopez",
    className: "English 9",
    room: "108",
    status: "confirmed",
    createdAt: new Date().toISOString(),
  },
  {
    id: "bk-3",
    cartId: "cart-c",
    date: today,
    periodId: 5,
    teacherEmail: "j.park@cubicle.edu",
    teacherName: "James Park",
    className: "World History",
    room: "301",
    status: "confirmed",
    createdAt: new Date().toISOString(),
  },
  {
    id: "bk-4",
    cartId: "cart-a",
    date: today,
    periodId: 6,
    teacherEmail: "a.nguyen@cubicle.edu",
    teacherName: "Amy Nguyen",
    className: "Algebra II",
    room: "220",
    status: "confirmed",
    createdAt: new Date().toISOString(),
  },
];

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

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
/** Bump when seed shape / demo dataset changes so clients rehydrate fresh sample data. */
const STORAGE_KEY = "cubicle_platform_v5";
const CHANGE_EVENT = "cubicle_platform_change";

function today() {
  return format(new Date(), "yyyy-MM-dd");
}

function dayOffset(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return format(d, "yyyy-MM-dd");
}

function hoursAgo(h: number) {
  return new Date(Date.now() - 1000 * 60 * 60 * h).toISOString();
}

function minsAgo(m: number) {
  return new Date(Date.now() - 1000 * 60 * m).toISOString();
}

/** 22 school laptop carts — tree names + home locations around campus. */
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
  { id: "cart-21", name: "Fir", status: "maintenance", laptopCount: 28, location: "IT closet" },
  { id: "cart-22", name: "Yew", status: "active", laptopCount: 24, location: "Counseling suite" },
];

type SeedBooking = {
  cartId: string;
  date: string;
  period: Booking["period"];
  teacherId: string;
  teacherName: string;
  className: string;
  subject?: string;
  notes?: string;
  hoursAgo?: number;
};

function makeBookings(rows: SeedBooking[]): Booking[] {
  return rows.map((row, i) => ({
    id: `bk-${i + 1}`,
    cartId: row.cartId,
    date: row.date,
    period: row.period,
    teacherId: row.teacherId,
    teacherName: row.teacherName,
    className: row.className,
    subject: row.subject,
    notes: row.notes,
    createdAt: hoursAgo(row.hoursAgo ?? 6 + (i % 18)),
  }));
}

/**
 * Realistic mid-week high school demo: dense today board, past-week volume
 * for sparklines, AP holds, fleet issues, and a couple of swap requests.
 */
function seed(): PlatformState {
  const d = today();
  const d1 = dayOffset(1);
  const d2 = dayOffset(2);
  const d3 = dayOffset(3);
  const ym1 = dayOffset(-1);
  const ym2 = dayOffset(-2);
  const ym3 = dayOffset(-3);
  const ym4 = dayOffset(-4);
  const ym5 = dayOffset(-5);

  const bookings = makeBookings([
    // ——— Today: busy morning + afternoon (typical Tuesday feel) ———
    {
      cartId: "cart-02",
      date: d,
      period: "P1",
      teacherId: "teacher-1",
      teacherName: "Sarah Chen",
      className: "AP Biology",
      subject: "Science",
      notes: "Chromebooks for online lab sim · Room 118",
      hoursAgo: 14,
    },
    {
      cartId: "cart-18",
      date: d,
      period: "P1",
      teacherId: "teacher-4",
      teacherName: "Priya Shah",
      className: "Algebra II",
      subject: "Math",
      notes: "Desmos classroom activity",
      hoursAgo: 14,
    },
    {
      cartId: "cart-15",
      date: d,
      period: "P1",
      teacherId: "teacher-5",
      teacherName: "Chris Ortiz",
      className: "English 11",
      subject: "ELA",
      hoursAgo: 13,
    },
    {
      cartId: "cart-01",
      date: d,
      period: "P2",
      teacherId: "teacher-1",
      teacherName: "Sarah Chen",
      className: "Biology 10",
      subject: "Science",
      notes: "Need 2 HDMI adapters",
      hoursAgo: 12,
    },
    {
      cartId: "cart-06",
      date: d,
      period: "P2",
      teacherId: "teacher-8",
      teacherName: "Nina Brooks",
      className: "French II",
      subject: "Languages",
      notes: "Listening lab · headsets already in cart",
      hoursAgo: 12,
    },
    {
      cartId: "cart-12",
      date: d,
      period: "P2",
      teacherId: "teacher-6",
      teacherName: "David Kim",
      className: "Chemistry 11",
      subject: "Science",
      hoursAgo: 11,
    },
    {
      cartId: "cart-04",
      date: d,
      period: "P3",
      teacherId: "teacher-2",
      teacherName: "Maria Lopez",
      className: "English 9",
      subject: "ELA",
      notes: "Socratic seminar docs in Drive",
      hoursAgo: 10,
    },
    {
      cartId: "cart-09",
      date: d,
      period: "P3",
      teacherId: "teacher-7",
      teacherName: "Aisha Rahman",
      className: "Computer Science",
      subject: "CTE",
      notes: "VS Code + GitHub Classroom",
      hoursAgo: 10,
    },
    {
      cartId: "cart-19",
      date: d,
      period: "P3",
      teacherId: "teacher-9",
      teacherName: "Tom Bradley",
      className: "PE Theory",
      subject: "PE",
      notes: "Fitness tracking forms",
      hoursAgo: 9,
    },
    {
      cartId: "cart-11",
      date: d,
      period: "P4",
      teacherId: "teacher-4",
      teacherName: "Priya Shah",
      className: "Algebra I",
      subject: "Math",
      hoursAgo: 8,
    },
    {
      cartId: "cart-03",
      date: d,
      period: "P4",
      teacherId: "teacher-10",
      teacherName: "Elena Vasquez",
      className: "Spanish I",
      subject: "Languages",
      hoursAgo: 8,
    },
    {
      cartId: "cart-16",
      date: d,
      period: "P4",
      teacherId: "teacher-5",
      teacherName: "Chris Ortiz",
      className: "Creative Writing",
      subject: "ELA",
      notes: "Workshop drafts — quiet room",
      hoursAgo: 7,
    },
    {
      cartId: "cart-08",
      date: d,
      period: "P5",
      teacherId: "teacher-3",
      teacherName: "James Park",
      className: "World History",
      subject: "Social Studies",
      notes: "Primary source stations",
      hoursAgo: 6,
    },
    {
      cartId: "cart-07",
      date: d,
      period: "P5",
      teacherId: "teacher-6",
      teacherName: "David Kim",
      className: "Physics 12",
      subject: "Science",
      notes: "PhET simulations",
      hoursAgo: 6,
    },
    {
      cartId: "cart-13",
      date: d,
      period: "P5",
      teacherId: "teacher-11",
      teacherName: "Robert Hale",
      className: "Business 11",
      subject: "CTE",
      notes: "Excel budget project",
      hoursAgo: 5,
    },
    {
      cartId: "cart-22",
      date: d,
      period: "P2",
      teacherId: "teacher-12",
      teacherName: "Grace Liu",
      className: "Career Planning",
      subject: "Counseling",
      notes: "Naviance login check",
      hoursAgo: 11,
    },

    // ——— Tomorrow ———
    {
      cartId: "cart-01",
      date: d1,
      period: "P1",
      teacherId: "teacher-7",
      teacherName: "Aisha Rahman",
      className: "CS Principles",
      subject: "CTE",
      hoursAgo: 20,
    },
    {
      cartId: "cart-03",
      date: d1,
      period: "P2",
      teacherId: "teacher-1",
      teacherName: "Sarah Chen",
      className: "Biology 10",
      subject: "Science",
      hoursAgo: 19,
    },
    {
      cartId: "cart-07",
      date: d1,
      period: "P3",
      teacherId: "teacher-2",
      teacherName: "Maria Lopez",
      className: "English 10",
      subject: "ELA",
      hoursAgo: 18,
    },
    {
      cartId: "cart-15",
      date: d1,
      period: "P3",
      teacherId: "teacher-5",
      teacherName: "Chris Ortiz",
      className: "Journalism",
      subject: "ELA",
      notes: "Yearbook photo uploads",
      hoursAgo: 18,
    },
    {
      cartId: "cart-18",
      date: d1,
      period: "P4",
      teacherId: "teacher-4",
      teacherName: "Priya Shah",
      className: "Geometry",
      subject: "Math",
      hoursAgo: 17,
    },
    {
      cartId: "cart-09",
      date: d1,
      period: "P5",
      teacherId: "teacher-6",
      teacherName: "David Kim",
      className: "Chemistry 11",
      subject: "Science",
      hoursAgo: 16,
    },
    {
      cartId: "cart-11",
      date: d1,
      period: "P2",
      teacherId: "teacher-10",
      teacherName: "Elena Vasquez",
      className: "Spanish II",
      subject: "Languages",
      hoursAgo: 19,
    },

    // ——— Day after tomorrow ———
    {
      cartId: "cart-01",
      date: d2,
      period: "P4",
      teacherId: "teacher-3",
      teacherName: "James Park",
      className: "Civics",
      subject: "Social Studies",
      hoursAgo: 22,
    },
    {
      cartId: "cart-05",
      date: d2,
      period: "P2",
      teacherId: "teacher-8",
      teacherName: "Nina Brooks",
      className: "French I",
      subject: "Languages",
      hoursAgo: 22,
    },
    {
      cartId: "cart-14",
      date: d2,
      period: "P3",
      teacherId: "teacher-11",
      teacherName: "Robert Hale",
      className: "Marketing",
      subject: "CTE",
      hoursAgo: 21,
    },
    {
      cartId: "cart-16",
      date: d2,
      period: "P1",
      teacherId: "teacher-2",
      teacherName: "Maria Lopez",
      className: "English 9 Honors",
      subject: "ELA",
      hoursAgo: 21,
    },

    // ——— +3 days ———
    {
      cartId: "cart-08",
      date: d3,
      period: "P2",
      teacherId: "teacher-1",
      teacherName: "Sarah Chen",
      className: "AP Biology",
      subject: "Science",
      notes: "Practice FRQ digital",
      hoursAgo: 24,
    },
    {
      cartId: "cart-18",
      date: d3,
      period: "P5",
      teacherId: "teacher-4",
      teacherName: "Priya Shah",
      className: "Pre-Calculus",
      subject: "Math",
      hoursAgo: 24,
    },

    // ——— Yesterday (stats / sparklines) ———
    {
      cartId: "cart-05",
      date: ym1,
      period: "P1",
      teacherId: "teacher-1",
      teacherName: "Sarah Chen",
      className: "Biology 10 lab",
      subject: "Science",
      hoursAgo: 28,
    },
    {
      cartId: "cart-09",
      date: ym1,
      period: "P2",
      teacherId: "teacher-7",
      teacherName: "Aisha Rahman",
      className: "Web Design",
      subject: "CTE",
      hoursAgo: 27,
    },
    {
      cartId: "cart-02",
      date: ym1,
      period: "P3",
      teacherId: "teacher-2",
      teacherName: "Maria Lopez",
      className: "English 9",
      subject: "ELA",
      hoursAgo: 26,
    },
    {
      cartId: "cart-11",
      date: ym1,
      period: "P4",
      teacherId: "teacher-4",
      teacherName: "Priya Shah",
      className: "Geometry",
      subject: "Math",
      hoursAgo: 26,
    },
    {
      cartId: "cart-15",
      date: ym1,
      period: "P5",
      teacherId: "teacher-5",
      teacherName: "Chris Ortiz",
      className: "English 11",
      subject: "ELA",
      hoursAgo: 25,
    },
    {
      cartId: "cart-06",
      date: ym1,
      period: "P3",
      teacherId: "teacher-10",
      teacherName: "Elena Vasquez",
      className: "Spanish I",
      subject: "Languages",
      hoursAgo: 26,
    },
    {
      cartId: "cart-13",
      date: ym1,
      period: "P1",
      teacherId: "teacher-3",
      teacherName: "James Park",
      className: "World History",
      subject: "Social Studies",
      hoursAgo: 29,
    },
    {
      cartId: "cart-20",
      date: ym1,
      period: "P4",
      teacherId: "teacher-9",
      teacherName: "Tom Bradley",
      className: "Health 9",
      subject: "PE",
      hoursAgo: 25,
    },

    // ——— −2 days ———
    {
      cartId: "cart-12",
      date: ym2,
      period: "P1",
      teacherId: "teacher-5",
      teacherName: "Chris Ortiz",
      className: "Journalism",
      subject: "ELA",
      hoursAgo: 52,
    },
    {
      cartId: "cart-18",
      date: ym2,
      period: "P2",
      teacherId: "teacher-2",
      teacherName: "Maria Lopez",
      className: "English 9",
      subject: "ELA",
      hoursAgo: 50,
    },
    {
      cartId: "cart-04",
      date: ym2,
      period: "P3",
      teacherId: "teacher-6",
      teacherName: "David Kim",
      className: "Chemistry 11",
      subject: "Science",
      hoursAgo: 49,
    },
    {
      cartId: "cart-01",
      date: ym2,
      period: "P4",
      teacherId: "teacher-1",
      teacherName: "Sarah Chen",
      className: "Biology 10",
      subject: "Science",
      hoursAgo: 48,
    },
    {
      cartId: "cart-08",
      date: ym2,
      period: "P5",
      teacherId: "teacher-7",
      teacherName: "Aisha Rahman",
      className: "Computer Science",
      subject: "CTE",
      hoursAgo: 47,
    },
    {
      cartId: "cart-17",
      date: ym2,
      period: "P2",
      teacherId: "teacher-11",
      teacherName: "Robert Hale",
      className: "Business 11",
      subject: "CTE",
      hoursAgo: 50,
    },

    // ——— −3 days ———
    {
      cartId: "cart-03",
      date: ym3,
      period: "P2",
      teacherId: "teacher-4",
      teacherName: "Priya Shah",
      className: "Algebra I",
      subject: "Math",
      hoursAgo: 72,
    },
    {
      cartId: "cart-15",
      date: ym3,
      period: "P3",
      teacherId: "teacher-8",
      teacherName: "Nina Brooks",
      className: "French II",
      subject: "Languages",
      hoursAgo: 70,
    },
    {
      cartId: "cart-09",
      date: ym3,
      period: "P4",
      teacherId: "teacher-3",
      teacherName: "James Park",
      className: "Civics",
      subject: "Social Studies",
      hoursAgo: 69,
    },
    {
      cartId: "cart-02",
      date: ym3,
      period: "P5",
      teacherId: "teacher-5",
      teacherName: "Chris Ortiz",
      className: "Creative Writing",
      subject: "ELA",
      hoursAgo: 68,
    },
    {
      cartId: "cart-19",
      date: ym3,
      period: "P1",
      teacherId: "teacher-12",
      teacherName: "Grace Liu",
      className: "Advisory",
      subject: "Counseling",
      hoursAgo: 74,
    },

    // ——— −4 / −5 (lighter load days) ———
    {
      cartId: "cart-06",
      date: ym4,
      period: "P2",
      teacherId: "teacher-1",
      teacherName: "Sarah Chen",
      className: "AP Biology",
      subject: "Science",
      hoursAgo: 96,
    },
    {
      cartId: "cart-11",
      date: ym4,
      period: "P3",
      teacherId: "teacher-10",
      teacherName: "Elena Vasquez",
      className: "Spanish I",
      subject: "Languages",
      hoursAgo: 94,
    },
    {
      cartId: "cart-14",
      date: ym4,
      period: "P4",
      teacherId: "teacher-2",
      teacherName: "Maria Lopez",
      className: "English 10",
      subject: "ELA",
      hoursAgo: 93,
    },
    {
      cartId: "cart-01",
      date: ym5,
      period: "P1",
      teacherId: "teacher-6",
      teacherName: "David Kim",
      className: "Physics 12",
      subject: "Science",
      hoursAgo: 120,
    },
    {
      cartId: "cart-18",
      date: ym5,
      period: "P3",
      teacherId: "teacher-4",
      teacherName: "Priya Shah",
      className: "Algebra II",
      subject: "Math",
      hoursAgo: 118,
    },
    {
      cartId: "cart-07",
      date: ym5,
      period: "P5",
      teacherId: "teacher-7",
      teacherName: "Aisha Rahman",
      className: "CS Principles",
      subject: "CTE",
      hoursAgo: 116,
    },
  ]);

  return {
    carts: SEED_CARTS,
    bookings,
    issues: [
      {
        id: "iss-1",
        cartId: "cart-10",
        description:
          "Three laptops won't charge in slots 4, 11, and 18. Battery LEDs stay dark after overnight charge.",
        severity: "high",
        status: "open",
        reportedById: "teacher-1",
        reporterName: "Sarah Chen",
        createdAt: hoursAgo(5),
      },
      {
        id: "iss-2",
        cartId: "cart-04",
        description:
          "Wobbly front-left wheel — hard to roll between floors. Still usable on one level.",
        severity: "low",
        status: "open",
        reportedById: "teacher-2",
        reporterName: "Maria Lopez",
        createdAt: hoursAgo(20),
      },
      {
        id: "iss-3",
        cartId: "cart-08",
        description:
          "Two keyboards missing letters; students couldn't finish login on time for P3.",
        severity: "medium",
        status: "resolved",
        reportedById: "teacher-3",
        reporterName: "James Park",
        createdAt: hoursAgo(48),
      },
      {
        id: "iss-4",
        cartId: "cart-21",
        description:
          "Cart lock code sticky; staff needed ~5 extra minutes to open before P2.",
        severity: "medium",
        status: "open",
        reportedById: "teacher-5",
        reporterName: "Chris Ortiz",
        createdAt: hoursAgo(8),
      },
      {
        id: "iss-5",
        cartId: "cart-07",
        description:
          "Trackpad unresponsive on 4 machines after Windows update. Students used external mice.",
        severity: "medium",
        status: "open",
        reportedById: "teacher-6",
        reporterName: "David Kim",
        createdAt: hoursAgo(3),
      },
      {
        id: "iss-6",
        cartId: "cart-15",
        description:
          "Power brick missing from slot 22. Cart still charges other units fine.",
        severity: "low",
        status: "open",
        reportedById: "teacher-5",
        reporterName: "Chris Ortiz",
        createdAt: hoursAgo(30),
      },
      {
        id: "iss-7",
        cartId: "cart-01",
        description:
          "Library Wi‑Fi dropped for ~12 min during P2 — not cart hardware. Logged for IT.",
        severity: "low",
        status: "resolved",
        reportedById: "teacher-1",
        reporterName: "Sarah Chen",
        createdAt: hoursAgo(26),
      },
      {
        id: "iss-8",
        cartId: "cart-09",
        description:
          "Two screens show pink vertical lines. Still bootable; swapped out for CS class.",
        severity: "high",
        status: "open",
        reportedById: "teacher-7",
        reporterName: "Aisha Rahman",
        createdAt: hoursAgo(14),
      },
      {
        id: "iss-9",
        cartId: "cart-18",
        description:
          "Door latch doesn't stay closed when cart is full — safety tape for now.",
        severity: "medium",
        status: "open",
        reportedById: "teacher-4",
        reporterName: "Priya Shah",
        createdAt: hoursAgo(40),
      },
      {
        id: "iss-10",
        cartId: "cart-12",
        description: "Student reported sticky spacebar on unit 07. Cleaned; monitoring.",
        severity: "low",
        status: "resolved",
        reportedById: "teacher-10",
        reporterName: "Elena Vasquez",
        createdAt: hoursAgo(55),
      },
    ],
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
    slotRestrictions: [
      {
        id: "sr-1",
        cartId: "cart-08",
        date: d1,
        period: "P1",
        category: "ap_exam",
        reason: "AP Chemistry digital exam block — Lab 1 reserved",
      },
      {
        id: "sr-2",
        cartId: "cart-09",
        date: d1,
        period: "P1",
        category: "ap_exam",
        reason: "AP Chemistry overflow seating",
      },
      {
        id: "sr-3",
        cartId: "cart-01",
        date: d2,
        period: "P3",
        category: "general",
        reason: "Library orientation — Oak staged in lobby",
      },
      {
        id: "sr-4",
        cartId: "cart-02",
        date: d2,
        period: "P3",
        category: "general",
        reason: "Library orientation overflow",
      },
      {
        id: "sr-5",
        cartId: "cart-15",
        date: d,
        period: "P5",
        category: "other",
        reason: "IEP assessment — counselor priority hold",
      },
      {
        id: "sr-6",
        cartId: "cart-18",
        date: d3,
        period: "P1",
        category: "ap_exam",
        reason: "AP Precalculus practice exam",
      },
    ],
    bookingPolicy: { maxAdvanceDays: 14 },
    swapRequests: [
      {
        id: "sw-1",
        bookingId: "bk-4", // Biology 10 P2 Oak — index depends on order
        requesterId: "teacher-2",
        requesterName: "Maria Lopez",
        reason: "Need laptops for Socratic seminar",
        message:
          "Happy to take any free cart near English wing if Biology can flex.",
        status: "pending",
        createdAt: minsAgo(45),
      },
      {
        id: "sw-2",
        bookingId: "bk-9",
        requesterId: "teacher-8",
        requesterName: "Nina Brooks",
        reason: "Listening lab conflict",
        message: "Can trade P3 for P4 if you still need CS machines.",
        status: "pending",
        createdAt: minsAgo(110),
      },
      {
        id: "sw-3",
        bookingId: "bk-13",
        requesterId: "teacher-12",
        requesterName: "Grace Liu",
        reason: "Career planning makeup session",
        message: "Only need 12 seats — flexible on cart.",
        status: "declined",
        createdAt: hoursAgo(18),
      },
    ],
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

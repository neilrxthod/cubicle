/**
 * Product changelog — newest first.
 * Prefer major/minor entries over routine patch noise.
 */

export type ChangelogKind = "major" | "minor" | "patch";

export type ChangelogEntry = {
  version: string;
  date: string;
  kind: ChangelogKind;
  title: string;
  summary: string;
  highlights: string[];
  improvements?: string[];
  fixes?: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.0.0",
    date: "2026-07-31",
    kind: "major",
    title: "Platform 1.0",
    summary:
      "Initial production release of Cubicle for school laptop-cart scheduling, staff onboarding, and operations.",
    highlights: [
      "Period-based schedule board for cart reservations",
      "Personal bookings with cancel support",
      "Two-step staff onboarding (profile and teaching setup)",
      "Saskatchewan statutory holiday blocks on the calendar",
      "Cart issue reporting and maintenance workflows",
      "Admin console for fleet, bookings, and staff",
      "Google sign-in limited to allowlisted school domains",
      "Legal and compliance document suite",
    ],
    improvements: [
      "Minimal bookings list (Upcoming and Past)",
      "Platform version in product header with changelog link",
      "Unified product typography across dashboard surfaces",
      "Report-issue dialog polish",
      "Aligned auth and onboarding brand panels",
    ],
    fixes: [
      "Dialog close control no longer shows a heavy click focus ring",
      "Onboarding and admin analytics type and lint issues",
    ],
  },
];

export function getLatestChangelog(): ChangelogEntry | undefined {
  return CHANGELOG[0];
}

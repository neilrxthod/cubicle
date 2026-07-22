import type { EmploymentType } from "@/lib/types";

export const EMPLOYMENT_TYPES: Array<{
  id: EmploymentType;
  label: string;
  shortLabel: string;
  description: string;
  verified: boolean;
}> = [
  {
    id: "permanent",
    label: "Permanent",
    shortLabel: "Permanent",
    description: "Blue tick.",
    verified: true,
  },
  {
    id: "substitute",
    label: "Substitute",
    shortLabel: "Substitute",
    description: "No tick.",
    verified: false,
  },
  {
    id: "temporary",
    label: "Temporary",
    shortLabel: "Temporary",
    description: "No tick.",
    verified: false,
  },
];

export function parseEmploymentType(
  value: unknown,
  fallback: EmploymentType = "permanent",
): EmploymentType {
  if (value === "permanent" || value === "substitute" || value === "temporary") {
    return value;
  }
  return fallback;
}

/**
 * Blue-tick eligibility: permanent employment and currently allowed to sign in.
 * (Revoked access loses the tick. Session users without allowlisted still OK.)
 */
export function isVerifiedStaff(
  user:
    | {
        employmentType?: EmploymentType;
        allowlisted?: boolean;
      }
    | null
    | undefined,
): boolean {
  if (!user) return false;
  if (user.allowlisted === false) return false;
  return (user.employmentType ?? "permanent") === "permanent";
}

export function employmentLabel(type: EmploymentType | undefined): string {
  const found = EMPLOYMENT_TYPES.find((e) => e.id === (type ?? "permanent"));
  return found?.shortLabel ?? "Permanent";
}

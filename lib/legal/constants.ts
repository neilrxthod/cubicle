import { SITE_DOMAIN } from "@/lib/site";

export const LEGAL_ORG = "Cubicle";
export const LEGAL_PRODUCT = "Cubicle";
export const LEGAL_DOMAIN = SITE_DOMAIN;
export const LEGAL_SCHOOL_DOMAIN = "rbe.sk.ca";
export const LEGAL_CONTACT_EMAIL = "it-support@rbe.sk.ca";
export const LEGAL_EFFECTIVE_DATE = "August 20, 2026";

export const LEGAL_LINKS = [
  {
    href: "/legal/terms",
    label: "Terms & Conditions",
    shortLabel: "Terms & Conditions",
    description:
      "Binding terms and conditions for authorized school staff using Cubicle.",
  },
  {
    href: "/legal/privacy",
    label: "Privacy Policy",
    shortLabel: "Privacy Policy",
    description:
      "What personal information we process, why, how long, and your rights.",
  },
  {
    href: "/legal/security",
    label: "Security & Data Safety",
    shortLabel: "Security & Data Safety",
    description:
      "Authentication, access control, infrastructure, and incident handling.",
  },
  {
    href: "/legal/acceptable-use",
    label: "Acceptable Use Policy",
    shortLabel: "Acceptable Use Policy",
    description:
      "Permitted and prohibited use of bookings, inventory, and school data.",
  },
] as const;

export const LEGAL_ORG = "Cubicle";
export const LEGAL_PRODUCT = "Cubicle";
export const LEGAL_DOMAIN = "mycubicle.app";
export const LEGAL_SCHOOL_DOMAIN = "rbe.sk.ca";
export const LEGAL_CONTACT_EMAIL = "it-support@rbe.sk.ca";
export const LEGAL_EFFECTIVE_DATE = "July 22, 2026";

export const LEGAL_LINKS = [
  {
    href: "/legal/terms",
    label: "Terms of Service",
    shortLabel: "Terms",
    description: "Rules for using Cubicle as authorized school staff.",
  },
  {
    href: "/legal/privacy",
    label: "Privacy Policy",
    shortLabel: "Privacy",
    description: "What we process, why, and how it is protected.",
  },
  {
    href: "/legal/security",
    label: "Security & Data Safety",
    shortLabel: "Security",
    description: "Credentials, access controls, and data handling.",
  },
  {
    href: "/legal/acceptable-use",
    label: "Acceptable Use",
    shortLabel: "Acceptable use",
    description: "What is allowed and what is not on the platform.",
  },
] as const;

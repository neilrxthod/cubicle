import type { Metadata } from "next";
import { SITE_DOMAIN, SITE_ORIGIN } from "@/lib/site";
import { LEGAL_SCHOOL_DOMAIN } from "@/lib/legal/constants";

/** Public product name — used in titles, JSON-LD, and llms.txt. */
export const SEO_NAME = "Cubicle";

export const SEO_TAGLINE =
  "Laptop cart scheduling for authorized school staff.";

export const SEO_DESCRIPTION =
  "Cubicle is a school operations platform for booking laptop carts by period, reporting equipment issues, and managing fleet inventory. Access is limited to allowlisted @" +
  LEGAL_SCHOOL_DOMAIN +
  " Google Workspace accounts.";

export const SEO_SHORT_DESCRIPTION =
  "Book laptop carts by period. Authorized school staff only.";

export const PUBLIC_PATHS = [
  "/login",
  "/about",
  "/legal",
  "/legal/terms",
  "/legal/intellectual-property",
  "/legal/privacy",
  "/legal/security",
  "/legal/acceptable-use",
] as const;

export const PUBLIC_ROBOTS: Metadata["robots"] = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
  },
};

export const APP_ROBOTS: Metadata["robots"] = {
  index: false,
  follow: false,
  nocache: true,
  googleBot: {
    index: false,
    follow: false,
    noimageindex: true,
  },
};

export type SeoFaq = { question: string; answer: string };

/** Direct answers for search, answer engines, and generative engines. */
export const SEO_FAQS: SeoFaq[] = [
  {
    question: "What is Cubicle?",
    answer:
      "Cubicle is a web app for school staff to book shared laptop carts by class period, see who has each cart, report equipment issues, and let IT manage inventory. It is an internal operations tool, not a consumer product.",
  },
  {
    question: "Who can use Cubicle?",
    answer: `Only allowlisted staff Google accounts at @${LEGAL_SCHOOL_DOMAIN} can sign in. Public sign-up, Gmail, and other domains are rejected.`,
  },
  {
    question: "How do teachers book a laptop cart?",
    answer:
      "Sign in with the school Google account, open the daily board, pick a date and period, and reserve an available cart. Teachers can cancel their own bookings, request a swap, or share a slot with a colleague.",
  },
  {
    question: "Does Cubicle send email notifications?",
    answer:
      "Yes. Staff can receive email when a cart is shared, swapped, moved, or cancelled, and admins can receive email when someone reports a cart issue. Each person can turn those emails on or off in Settings.",
  },
  {
    question: "Where do I sign in?",
    answer: `Sign in at ${SITE_ORIGIN}/login with an allowlisted @${LEGAL_SCHOOL_DOMAIN} Google account.`,
  },
  {
    question: "Is Cubicle a public booking site?",
    answer:
      "No. The schedule, inventory, and staff directory are private. Only sign-in, about, and legal pages are public.",
  },
];

export function publicPageMetadata(input: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const url = `${SITE_ORIGIN}${input.path}`;
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: url },
    robots: PUBLIC_ROBOTS,
    keywords: [
      "Cubicle",
      "laptop cart booking",
      "school laptop carts",
      "teacher cart schedule",
      LEGAL_SCHOOL_DOMAIN,
      "school staff operations",
    ],
    openGraph: {
      title: `${input.title} · ${SEO_NAME}`,
      description: input.description,
      url,
      siteName: SEO_NAME,
      type: "website",
      locale: "en_CA",
    },
    twitter: {
      card: "summary_large_image",
      title: `${input.title} · ${SEO_NAME}`,
      description: input.description,
    },
  };
}

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_ORIGIN}/#organization`,
        name: SEO_NAME,
        url: SITE_ORIGIN,
        email: "it-support@rbe.sk.ca",
        logo: `${SITE_ORIGIN}/icons/icon-512.png`,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_ORIGIN}/#website`,
        name: SEO_NAME,
        url: SITE_ORIGIN,
        description: SEO_DESCRIPTION,
        publisher: { "@id": `${SITE_ORIGIN}/#organization` },
        inLanguage: "en-CA",
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_ORIGIN}/#app`,
        name: SEO_NAME,
        applicationCategory: "BusinessApplication",
        applicationSubCategory: "Education",
        operatingSystem: "Web",
        url: `${SITE_ORIGIN}/login`,
        description: SEO_DESCRIPTION,
        featureList: [
          "Period-based laptop cart booking",
          "Shared daily schedule board",
          "Equipment issue reporting",
          "Cart share and swap requests",
          "Admin inventory and staff allowlist",
          "Email notifications for schedule changes",
        ],
        isAccessibleForFree: false,
        audience: {
          "@type": "EducationalAudience",
          educationalRole: "teacher",
        },
        provider: { "@id": `${SITE_ORIGIN}/#organization` },
      },
      {
        "@type": "FAQPage",
        "@id": `${SITE_ORIGIN}/about#faq`,
        mainEntity: SEO_FAQS.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      },
    ],
  };
}

export function jsonLdScript(data: unknown) {
  return serializeJsonLd(data);
}

export { SITE_DOMAIN, SITE_ORIGIN };

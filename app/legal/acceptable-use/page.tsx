import type { Metadata } from "next";
import {
  LegalList,
  LegalSection,
  LegalShell,
} from "@/components/legal/legal-shell";
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_PRODUCT,
  LEGAL_SCHOOL_DOMAIN,
} from "@/lib/legal/constants";

export const metadata: Metadata = {
  title: "Acceptable Use Policy",
  description: `Rules for appropriate use of ${LEGAL_PRODUCT} by school staff.`,
};

export default function AcceptableUsePage() {
  return (
    <LegalShell
      title="Acceptable Use Policy"
      description={`Rules for using ${LEGAL_PRODUCT} in a professional, secure, and school-appropriate manner.`}
      effectiveDate={LEGAL_EFFECTIVE_DATE}
      currentHref="/legal/acceptable-use"
    >
      <LegalSection title="1. Purpose">
        <p>
          {LEGAL_PRODUCT} supports fair, efficient scheduling of school laptop
          carts and related IT operations. This policy defines acceptable and
          prohibited use by authorized staff.
        </p>
      </LegalSection>

      <LegalSection title="2. Permitted use">
        <LegalList
          items={[
            "Viewing availability and booking carts for instructional needs.",
            "Reporting equipment problems accurately and promptly.",
            "Requesting schedule swaps when operationally necessary.",
            "Administrators maintaining cart status, restrictions, and staff access.",
            "Updating your own professional profile information.",
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Prohibited use">
        <LegalList
          items={[
            "Signing in with non-school accounts (including Gmail or other personal domains).",
            "Attempting to access the platform without allowlist approval.",
            "Sharing accounts, session cookies, or credentials with others.",
            "Bypassing, probing, or disabling security or access controls.",
            "Booking resources in bad faith (hoarding carts, fake classes, harassment).",
            "Entering unlawful, abusive, or unnecessary sensitive personal information.",
            "Using the platform for commercial activity unrelated to school duties.",
            "Interfering with availability, integrity, or performance of the service.",
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Professional standards">
        <LegalList
          items={[
            "Provide accurate booking details (period, room, class context).",
            "Cancel or free bookings you no longer need so others can use carts.",
            "Report safety or equipment risks with appropriate severity.",
            "Treat admin and teacher data as confidential school operational information.",
          ]}
        />
      </LegalSection>

      <LegalSection title="5. Access domain rule">
        <p>
          Only Google accounts ending in{" "}
          <strong>@{LEGAL_SCHOOL_DOMAIN}</strong> that are present on the IT
          allowlist may use {LEGAL_PRODUCT}. All other domains are blocked.
        </p>
      </LegalSection>

      <LegalSection title="6. Enforcement">
        <p>
          Violations may result in warning, temporary suspension, permanent
          removal from the allowlist, referral to school administration, or
          other actions under division policy and applicable law.
        </p>
      </LegalSection>

      <LegalSection title="7. Reporting">
        <p>
          Report misuse or security concerns to{" "}
          <a
            className="font-medium text-neutral-950 underline underline-offset-2"
            href={`mailto:${LEGAL_CONTACT_EMAIL}`}
          >
            {LEGAL_CONTACT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>
    </LegalShell>
  );
}

import type { Metadata } from "next";
import {
  LegalList,
  LegalSection,
  LegalShell,
} from "@/components/legal/legal-shell";
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_DOMAIN,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_PRODUCT,
  LEGAL_SCHOOL_DOMAIN,
} from "@/lib/legal/constants";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `Terms governing use of ${LEGAL_PRODUCT} by authorized school staff.`,
};

export default function TermsPage() {
  return (
    <LegalShell
      title="Terms of Service"
      description={`These Terms govern access to and use of ${LEGAL_PRODUCT} (${LEGAL_DOMAIN}), a school resource scheduling platform for authorized staff.`}
      effectiveDate={LEGAL_EFFECTIVE_DATE}
    >
      <LegalSection title="1. Agreement">
        <p>
          By signing in to {LEGAL_PRODUCT}, you agree to these Terms of Service,
          the Privacy Policy, the Security &amp; Data Safety statement, and the
          Acceptable Use Policy. If you do not agree, do not use the platform.
        </p>
      </LegalSection>

      <LegalSection title="2. Eligibility and authorized users">
        <p>
          {LEGAL_PRODUCT} is provided solely for authorized personnel of the
          participating school division. Access is limited as follows:
        </p>
        <LegalList
          items={[
            `Google accounts must use the school domain @${LEGAL_SCHOOL_DOMAIN}.`,
            "Personal accounts (including Gmail and other consumer domains) are prohibited.",
            "Even school-domain accounts must appear on the IT allowlist before access is granted.",
            "Roles (teacher or admin) are assigned by authorized administrators, not by end users.",
          ]}
        />
      </LegalSection>

      <LegalSection title="3. License to use">
        <p>
          Subject to these Terms, you receive a limited, non-exclusive,
          non-transferable, revocable right to use {LEGAL_PRODUCT} for
          legitimate school operations such as booking laptop carts, reporting
          equipment issues, and related administrative tasks.
        </p>
      </LegalSection>

      <LegalSection title="4. Accounts and authentication">
        <LegalList
          items={[
            "Authentication is performed via Google Sign-In through our identity provider (Supabase Auth).",
            "You must protect your school Google credentials and never share account access.",
            "You are responsible for activity conducted under your authenticated session.",
            "We may suspend or revoke access for security, policy, or employment-status reasons.",
          ]}
        />
      </LegalSection>

      <LegalSection title="5. Acceptable use">
        <p>
          You must use {LEGAL_PRODUCT} lawfully and in accordance with school
          division policies. Prohibited conduct includes attempting to bypass
          access controls, accessing another user’s account, abusing booking
          systems, uploading malware, or using the platform for non-school
          purposes. See the Acceptable Use Policy for details.
        </p>
      </LegalSection>

      <LegalSection title="6. School data and content">
        <p>
          Booking records, issue reports, profile fields, and related
          operational data are school division records processed to deliver the
          service. You retain responsibility for the accuracy of information you
          enter (for example class names, rooms, and issue descriptions).
        </p>
      </LegalSection>

      <LegalSection title="7. Availability and changes">
        <p>
          We aim for reliable availability but do not guarantee uninterrupted
          operation. Features may be updated, suspended, or discontinued as
          needed for maintenance, security, or operational improvement. Where
          practical, material changes will be communicated to administrators.
        </p>
      </LegalSection>

      <LegalSection title="8. Disclaimers">
        <p>
          {LEGAL_PRODUCT} is provided on an “as is” and “as available” basis for
          school operational use. To the fullest extent permitted by law, we
          disclaim warranties of merchantability, fitness for a particular
          purpose, and non-infringement. The platform is not a substitute for
          emergency communication systems or official student information
          systems.
        </p>
      </LegalSection>

      <LegalSection title="9. Limitation of liability">
        <p>
          To the fullest extent permitted by applicable law, {LEGAL_PRODUCT} and
          its operators shall not be liable for indirect, incidental, special,
          consequential, or punitive damages, or for loss of data, goodwill, or
          business interruption arising from use of the platform. Nothing in
          these Terms excludes liability that cannot be excluded under
          applicable law.
        </p>
      </LegalSection>

      <LegalSection title="10. Termination">
        <p>
          Access may end when employment or assignment ends, when you are
          removed from the allowlist, when credentials are revoked, or when
          these Terms are violated. Upon termination, your right to use the
          platform ceases immediately.
        </p>
      </LegalSection>

      <LegalSection title="11. Governing context">
        <p>
          {LEGAL_PRODUCT} is operated for school use in Saskatchewan, Canada.
          Use is also subject to applicable school division policies, provincial
          education requirements, and Canadian privacy law. If a conflict exists
          between these Terms and mandatory law or board policy, the mandatory
          rule prevails.
        </p>
      </LegalSection>

      <LegalSection title="12. Contact">
        <p>
          Questions about these Terms:{" "}
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

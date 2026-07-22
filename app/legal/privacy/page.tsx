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
  title: "Privacy Policy",
  description: `How ${LEGAL_PRODUCT} collects, uses, and protects personal information.`,
};

export default function PrivacyPage() {
  return (
    <LegalShell
      title="Privacy Policy"
      description={`This Privacy Policy explains what information ${LEGAL_PRODUCT} processes, why it is processed, and how it is protected for authorized school staff.`}
      effectiveDate={LEGAL_EFFECTIVE_DATE}
      currentHref="/legal/privacy"
    >
      <LegalSection title="1. Scope">
        <p>
          This policy applies to {LEGAL_PRODUCT} available at {LEGAL_DOMAIN}. It
          is intended for staff users (teachers and IT/admin personnel), not for
          student-facing consumer accounts. {LEGAL_PRODUCT} is designed as an
          internal school operations tool.
        </p>
      </LegalSection>

      <LegalSection title="2. Information we process">
        <p>Depending on use, we may process:</p>
        <LegalList
          items={[
            "Identity data from Google Sign-In (name, school email address, profile photo URL when provided).",
            "Account profile fields you choose to save (title, department, phone, bio, notification preferences).",
            "Operational data you create (cart bookings, swap requests, issue reports, and related timestamps).",
            "Technical logs needed for security and reliability (for example authentication events and error diagnostics).",
            "Allowlist records maintained by IT (approved school email and assigned role).",
          ]}
        />
        <p>
          {LEGAL_PRODUCT} is not intended to collect student personal education
          records as a primary purpose. Avoid entering sensitive student
          identifiers unless required by your division procedures.
        </p>
      </LegalSection>

      <LegalSection title="3. How we use information">
        <LegalList
          items={[
            "Authenticate users and enforce school-domain and allowlist access controls.",
            "Provide booking boards, schedules, maintenance status, and admin tooling.",
            "Communicate operational status related to carts, issues, and account activity.",
            "Maintain security, prevent abuse, and diagnose service problems.",
            "Meet school division record-keeping and audit needs where applicable.",
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Legal / operational basis">
        <p>
          Information is processed to deliver a school-authorized service to
          staff, support educational operations, and protect systems and users.
          Processing is limited to what is needed for those purposes.
        </p>
      </LegalSection>

      <LegalSection title="5. Access controls">
        <LegalList
          items={[
            `Only @${LEGAL_SCHOOL_DOMAIN} Google accounts may authenticate.`,
            "An approved allowlist entry is required in addition to the school domain.",
            "Role-based access separates teacher and administrator capabilities.",
            "Database row-level security (RLS) restricts what authenticated users can read or change.",
          ]}
        />
      </LegalSection>

      <LegalSection title="6. Sharing and processors">
        <p>
          We use trusted infrastructure providers to operate the service,
          including:
        </p>
        <LegalList
          items={[
            "Supabase — authentication and managed PostgreSQL database.",
            "Google — identity provider for school Google Workspace sign-in.",
            "Vercel — application hosting and delivery.",
            "name.com (or your DNS provider) — domain name services.",
          ]}
        />
        <p>
          These providers process data under their agreements and security
          controls as needed to run the platform. We do not sell personal
          information.
        </p>
      </LegalSection>

      <LegalSection title="7. Retention">
        <p>
          Operational records (bookings, issues, profiles) are retained while
          needed for school operations, troubleshooting, and audit requirements.
          When an account is removed from the allowlist or access is revoked,
          sign-in is blocked. Record retention and deletion schedules should
          follow school division policy; administrators may request cleanup of
          specific records through IT.
        </p>
      </LegalSection>

      <LegalSection title="8. Security measures">
        <p>
          We apply administrative and technical safeguards described in the
          Security &amp; Data Safety statement, including encrypted transport
          (HTTPS), least-privilege credentials, allowlist enforcement, and
          role-based authorization. No method of transmission or storage is
          perfectly secure; report suspected incidents promptly.
        </p>
      </LegalSection>

      <LegalSection title="9. Your choices">
        <LegalList
          items={[
            "Update profile details in Settings where available.",
            "Sign out on shared devices after use.",
            "Contact IT to correct allowlist information or request account removal.",
            "Use school Google account security features (strong authentication, device protections).",
          ]}
        />
      </LegalSection>

      <LegalSection title="10. Children">
        <p>
          {LEGAL_PRODUCT} is directed to authorized staff users, not children.
          It is not a general public social platform.
        </p>
      </LegalSection>

      <LegalSection title="11. International processing">
        <p>
          Infrastructure providers may process data in Canada, the United
          States, or other regions depending on service configuration. Where
          required, the school division remains responsible for ensuring vendor
          arrangements meet its privacy obligations.
        </p>
      </LegalSection>

      <LegalSection title="12. Policy updates">
        <p>
          We may update this Privacy Policy to reflect product, legal, or
          operational changes. The effective date at the top will be revised
          when changes are published on {LEGAL_DOMAIN}.
        </p>
      </LegalSection>

      <LegalSection title="13. Contact / privacy requests">
        <p>
          For privacy questions or access/correction requests related to{" "}
          {LEGAL_PRODUCT}, contact your school division IT privacy contact or
          email{" "}
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

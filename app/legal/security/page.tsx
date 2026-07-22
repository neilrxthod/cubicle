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
  title: "Security & Data Safety",
  description: `Security controls and credential practices for ${LEGAL_PRODUCT}.`,
};

export default function SecurityPage() {
  return (
    <LegalShell
      title="Security & Data Safety"
      description={`How ${LEGAL_PRODUCT} protects credentials, school operational data, and platform integrity.`}
      effectiveDate={LEGAL_EFFECTIVE_DATE}
      currentHref="/legal/security"
    >
      <LegalSection title="1. Security principles">
        <LegalList
          items={[
            "Least privilege — users and services receive only the access they need.",
            "Defense in depth — domain checks, allowlists, roles, and database policies work together.",
            "Secure defaults — production uses real Google sign-in; demo credentials are not enabled by default.",
            "Separation of secrets — service credentials never ship to the browser.",
          ]}
        />
      </LegalSection>

      <LegalSection title="2. Authentication and credentials">
        <LegalList
          items={[
            "Staff sign in with school Google accounts via OAuth (no shared platform passwords for production users).",
            `Only @${LEGAL_SCHOOL_DOMAIN} addresses are accepted; consumer domains (e.g. gmail.com) are rejected.`,
            "Allowlist membership is required even for valid school-domain accounts.",
            "Unauthorized sign-in attempts result in session termination and removal of the unauthorized auth user.",
            "Google OAuth client secrets and Supabase service-role keys are stored as server-side environment variables (for example on Vercel), not in client code or the public repository.",
            "The Supabase anon key may appear in the browser by design; protection relies on Row Level Security and application access rules.",
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Authorization model">
        <LegalList
          items={[
            "Teacher and admin roles control which screens and actions are available.",
            "PostgreSQL Row Level Security (RLS) limits read/write access to authorized authenticated users.",
            "Administrators manage fleet status, restrictions, and staff allowlist entries.",
            "Teachers create bookings and issues associated with their authenticated identity.",
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Data protection in transit and at rest">
        <LegalList
          items={[
            "Production traffic is served over HTTPS/TLS via the hosting provider.",
            "Database and authentication services are provided by managed cloud infrastructure (Supabase).",
            "Application hosting is provided by Vercel with platform-managed certificates for the production domain.",
          ]}
        />
      </LegalSection>

      <LegalSection title="5. Application and repository hygiene">
        <LegalList
          items={[
            "The source repository is private.",
            "Environment files (.env*) are gitignored and must not be committed.",
            "Production environment variables are configured in the hosting dashboard, separate from source control.",
            "Dependency installs on CI use locked manifests; peer-dependency settings are controlled via project configuration.",
          ]}
        />
      </LegalSection>

      <LegalSection title="6. Operational data safety">
        <LegalList
          items={[
            "Bookings, issues, and cart status are school operational records—enter only work-appropriate information.",
            "Avoid storing passwords, government ID numbers, or unnecessary sensitive student data in free-text fields.",
            "High-severity equipment issues may automatically flag carts for maintenance to reduce classroom risk.",
            "Administrators should periodically review allowlist membership when staff join or leave.",
          ]}
        />
      </LegalSection>

      <LegalSection title="7. Monitoring and incident response">
        <p>If you suspect unauthorized access or a data incident:</p>
        <LegalList
          items={[
            "Sign out of Cubicle and your school Google account on the affected device.",
            "Report immediately to school division IT / the address below.",
            "Preserve relevant details (time, account used, screens observed) for investigation.",
            "Do not attempt to “test” security controls in ways that disrupt school operations.",
          ]}
        />
      </LegalSection>

      <LegalSection title="8. Shared responsibility">
        <p>
          Security is shared. Platform operators maintain application controls
          and infrastructure configuration; the school division manages staff
          offboarding, device policy, Google Workspace security, and local
          acceptable-use enforcement; individual users protect their sign-in
          sessions and handle data carefully.
        </p>
      </LegalSection>

      <LegalSection title="9. Contact">
        <p>
          Security concerns:{" "}
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

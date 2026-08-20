import type { Metadata } from "next";
import {
  LegalList,
  LegalSection,
  LegalShell,
  LegalSubheading,
  LegalToc,
} from "@/components/legal/legal-shell";
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_PRODUCT,
  LEGAL_SCHOOL_DOMAIN,
} from "@/lib/legal/constants";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "Security & Data Safety",
  description: `How ${LEGAL_PRODUCT} protects credentials, school operational data, sessions, and platform integrity.`,
  path: "/legal/security",
});

const TOC = [
  { href: "#1-purpose-of-this-statement", label: "1. Purpose of this statement" },
  { href: "#2-security-principles", label: "2. Security principles" },
  { href: "#3-what-we-protect", label: "3. What we protect" },
  { href: "#4-authentication-and-identity", label: "4. Authentication and identity" },
  { href: "#5-authorization-and-least-privilege", label: "5. Authorization and least privilege" },
  { href: "#6-secrets-and-credentials-hygiene", label: "6. Secrets and credentials hygiene" },
  { href: "#7-data-in-transit-and-at-rest", label: "7. Data in transit and at rest" },
  { href: "#8-application-hosting-and-delivery", label: "8. Application hosting and delivery" },
  { href: "#9-database-durability-and-backups", label: "9. Database durability and backups" },
  { href: "#10-client-cache-realtime-and-sessions", label: "10. Client cache, realtime, and sessions" },
  { href: "#11-email-delivery-security", label: "11. Email delivery security" },
  { href: "#12-devices-pwa-and-camera", label: "12. Devices, PWA, and camera" },
  { href: "#13-logging-and-monitoring", label: "13. Logging and monitoring" },
  { href: "#14-operational-data-hygiene", label: "14. Operational data hygiene" },
  { href: "#15-incident-response", label: "15. Incident response" },
  { href: "#16-vulnerability-disclosure", label: "16. Vulnerability disclosure" },
  { href: "#17-shared-responsibility", label: "17. Shared responsibility" },
  { href: "#18-what-this-statement-does-not-claim", label: "18. What this statement does not claim" },
  { href: "#19-contact", label: "19. Contact" },
] as const;

export default function SecurityPage() {
  return (
    <LegalShell
      title="Security & Data Safety"
      description={`How ${LEGAL_PRODUCT} protects credentials, school operational data, and platform integrity — and what users and the school division must still do.`}
      effectiveDate={LEGAL_EFFECTIVE_DATE}
    >
      <LegalToc items={TOC} />

      <LegalSection title="1. Purpose of this statement">
        <p>
          This statement describes the security model of {LEGAL_PRODUCT} in
          language staff, administrators, and division IT can use. It is not
          a penetration-test report, not a SOC 2 attestation, and not a
          guarantee that the service cannot be abused. It complements the{" "}
          <a href="/legal/terms">Terms &amp; Conditions</a>,{" "}
          <a href="/legal/privacy">Privacy Policy</a>, and{" "}
          <a href="/legal/acceptable-use">Acceptable Use Policy</a>.
        </p>
        <p>
          {LEGAL_PRODUCT} is a private school staff application. It is not a
          public SaaS marketplace. Production access is limited to allowlisted{" "}
          <strong>@{LEGAL_SCHOOL_DOMAIN}</strong> Google accounts.
        </p>
      </LegalSection>

      <LegalSection title="2. Security principles">
        <LegalList
          items={[
            "Least privilege — users and services receive only the access they need for their role.",
            "Defense in depth — school-domain checks, allowlists, roles, and database policies work together. No single control is treated as enough on its own.",
            "Secure defaults — production uses real Google sign-in; local demo credentials are not enabled on the production host.",
            "Separation of secrets — service-role keys, mail API keys, and OAuth client secrets never ship in the public client bundle or the public repository.",
            "Durability of school data — application deploys replace code, not the production database.",
            "Assume workplace devices — sessions may exist on shared classroom computers; sign-out and short-lived sessions matter.",
          ]}
        />
      </LegalSection>

      <LegalSection title="3. What we protect">
        <p>Primary assets include:</p>
        <LegalList
          items={[
            "Staff identity (school email, name, role, allowlist membership).",
            "Operational records (bookings, issues, restrictions, inventory, laptop codes, share and swap history).",
            "Administrative capability (who can delete bookings, pause carts, or change staff access).",
            "Integrity of the daily board (so staff can trust who has a cart).",
            "Availability during the school day, within the limits of third-party hosting.",
          ]}
        />
        <p>
          We do not treat {LEGAL_PRODUCT} as a store for student cumulative
          files, payment cards, or medical records. Putting those in
          free-text fields increases harm if an account is misused — do not
          do it.
        </p>
      </LegalSection>

      <LegalSection title="4. Authentication and identity">
        <LegalList
          items={[
            "Staff sign in with school Google accounts via OAuth through the identity provider (Supabase Auth). Production users do not receive a separate Cubicle password for Google sign-in.",
            `Only @${LEGAL_SCHOOL_DOMAIN} addresses are accepted. Consumer domains (for example gmail.com) are rejected.`,
            "Allowlist membership is required even for a valid school-domain account. Exact email matching is used; look-alike addresses are not a substitute.",
            "Unauthorized sign-in attempts result in session termination and removal of the unauthorized auth user where that control is enabled.",
            "Role (teacher or admin) comes from allowlist / profile data, not from a self-serve toggle in the teacher UI.",
            "Google Workspace security — 2-step verification, suspicious-login alerts, and account recovery — remains the foundation. Cubicle cannot compensate for a takeover of the Google account itself.",
          ]}
        />
        <LegalSubheading>What you must do</LegalSubheading>
        <LegalList
          items={[
            "Use a unique, strong Google password and 2-step verification as required by the division.",
            "Never approve an OAuth prompt you did not initiate.",
            "Sign out on shared devices.",
            "Report lost phones or suspected Google account abuse immediately.",
          ]}
        />
      </LegalSection>

      <LegalSection title="5. Authorization and least privilege">
        <LegalList
          items={[
            "Teacher and admin roles control which screens and actions are available in the interface.",
            "PostgreSQL Row Level Security (RLS) limits read and write access for the browser key to authorized authenticated users.",
            "Sensitive mutations (for example some share, swap, or admin operations) run through server-side or security-definer database functions that re-check identity.",
            "Administrators manage fleet status, restrictions, QR / laptop codes, and staff allowlist entries.",
            "Teachers create bookings and issues associated with their authenticated identity; they must not act as another person.",
            "Admin deletion of bookings (including another staff member’s booking) is an elevated operational action and is logged as a school record change.",
          ]}
        />
        <p>
          UI hiding is not the only control. Server and database rules are
          intended to reject actions your role is not allowed to perform.
          If you discover a way to perform an admin action as a teacher,
          stop and report it — do not keep using it.
        </p>
      </LegalSection>

      <LegalSection title="6. Secrets and credentials hygiene">
        <LegalList
          items={[
            "Google OAuth client secrets and Supabase service-role keys are stored as server-side environment variables (for example on the hosting dashboard), not in client code.",
            "Mail API keys used to send operational email are likewise server-only.",
            "The Supabase anonymous / publishable key may appear in the browser by design. Protection relies on Row Level Security, allowlist checks, and application rules — treat it as a public identifier, not a master password.",
            "Environment files are gitignored and must not be committed. The source repository is private.",
            "Demo login flags must never be enabled on the production host.",
          ]}
        />
        <p>
          If a secret may have been committed, pasted into chat, or otherwise
          exposed: rotate it immediately in the provider dashboard, redeploy,
          and review authentication and allowlist logs.
        </p>
      </LegalSection>

      <LegalSection title="7. Data in transit and at rest">
        <LegalList
          items={[
            "Production traffic is served over HTTPS/TLS via the hosting provider’s certificates for the production domain.",
            "Database, authentication, and realtime channels are provided by managed cloud infrastructure (Supabase) using encrypted transport.",
            "Managed providers typically encrypt storage volumes at rest as part of their platform; Cubicle does not independently re-encrypt every field with a school-held key.",
            "You should still avoid putting highly sensitive information in notes, because encryption does not prevent a legitimate admin from reading a field.",
          ]}
        />
      </LegalSection>

      <LegalSection title="8. Application hosting and delivery">
        <LegalList
          items={[
            "The web application is hosted on Vercel (or a successor host designated by operators) with platform-managed TLS for the production domain.",
            "Deploys from the main branch replace application code. They do not wipe the production database.",
            "Preview deployments, if used, must not be treated as a second copy of live school data unless IT has deliberately pointed them at a non-production project.",
            "HTTP security headers (including transport security, framing protections, and a content security policy) are applied at the host / application layer to reduce common web attacks.",
            "Camera permission, where used for QR scanning, is limited by permissions policy to the application’s own origin.",
          ]}
        />
      </LegalSection>

      <LegalSection title="9. Database durability and backups">
        <p>
          School bookings, carts, laptop codes, issues, staff allowlist,
          shares, swaps, and restrictions live in PostgreSQL. Pushing new
          code is not a data reset. Destruction of school data requires an
          explicit database operation (for example an administrator using an
          in-product clear tool, or a direct database change).
        </p>
        <LegalList
          items={[
            "IT should ensure provider backups remain enabled on the production project.",
            "Schema changes are additive where possible so existing rows survive upgrades.",
            "Administrators should use in-product clear tools only with a documented operational reason — they are irreversible from the teachers’ point of view.",
            "Local demo sandboxes on developer machines are isolated and must not be confused with production.",
          ]}
        />
      </LegalSection>

      <LegalSection title="10. Client cache, realtime, and sessions">
        <p>
          Open boards subscribe to database change events so other staff see
          bookings, cancellations, and inventory edits without reloading the
          browser tab. A short reconcile then confirms the client cache
          matches the server.
        </p>
        <LegalList
          items={[
            "The browser cache is a convenience copy of school operational data for signed-in use. It is not a second system of record.",
            "Clearing site data or signing out drops the local cache. Production rows remain in PostgreSQL.",
            "Realtime delivery depends on a live network connection; a missed event is repaired by refresh on focus and periodic reconcile while the tab is visible.",
            "Same-browser tabs also sync through local storage / broadcast mechanisms so a teacher with two windows does not see conflicting boards.",
          ]}
        />
        <p>
          Session cookies and tokens must be treated as passwords. Do not
          photograph a signed-in admin screen or send HAR files containing
          cookies in public channels.
        </p>
      </LegalSection>

      <LegalSection title="11. Email delivery security">
        <p>
          Operational email (shares, swaps, cancellations, issue notices,
          optional test messages) is sent through a transactional provider.
          Staff should treat unexpected messages that ask for passwords as
          phishing even if they mention Cubicle.
        </p>
        <LegalList
          items={[
            "The application does not ask you to reply with your Google password.",
            "Delivery status for a test message may be queried from the provider’s event log so you can see whether mail was accepted or delivered — that status is not a read-receipt of your personal inbox beyond what the provider reports.",
            "Inbox versus junk placement depends on school mail filters and domain authentication (SPF, DKIM, DMARC) operated at DNS — those records are a division / DNS responsibility as well as a sender-configuration responsibility.",
            "Mail API keys are server-side. Rotating an exposed key is mandatory.",
          ]}
        />
      </LegalSection>

      <LegalSection title="12. Devices, PWA, and camera">
        <LegalList
          items={[
            "The product may install as a progressive web app on a phone. That does not move school data off the production database; it caches an app shell and signed-in client state on that device.",
            "Lost devices should be treated as a potential session risk: sign out from another machine if possible, change the Google password, and tell IT.",
            "QR scanning uses the device camera only when you start a scan. Frames are used to decode labels, not to enrol biometric face data.",
            "School device-management policy (MDM, disk encryption, screen lock) still applies and is stronger than anything Cubicle can enforce alone.",
          ]}
        />
      </LegalSection>

      <LegalSection title="13. Logging and monitoring">
        <p>
          Operators and infrastructure providers may retain authentication
          events, application errors, and host access logs as needed to keep
          the service available and to investigate abuse. These logs are
          workplace operational records, not a public feed.
        </p>
        <p>
          Presence indicators show coarse signed-in state to colleagues. They
          are not a legal time clock. Administrators must not use them as
          covert off-duty tracking.
        </p>
      </LegalSection>

      <LegalSection title="14. Operational data hygiene">
        <LegalList
          items={[
            "Enter only work-appropriate information in bookings, issues, and profiles.",
            "Avoid storing passwords, government ID numbers, medical details, or unnecessary sensitive student data in free-text fields.",
            "High-severity equipment issues may automatically flag carts for maintenance to reduce classroom risk.",
            "Administrators should periodically review allowlist membership when staff join, change role, or leave.",
            "Laptop codes should be treated like asset-tag lists — useful inside the school, harmful if posted publicly.",
            "When a cart is retired, update inventory rather than leaving orphan codes in circulation.",
          ]}
        />
      </LegalSection>

      <LegalSection title="15. Incident response">
        <p>If you suspect unauthorized access, data exposure, or a compromised device:</p>
        <LegalList
          items={[
            "Sign out of Cubicle and your school Google account on the affected device.",
            "If the Google account may be compromised, change the password and review third-party app access from a known-good device.",
            "Report immediately to school division IT at the address below. Include time, account used, what you saw, and whether students were nearby.",
            "Preserve relevant details (do not wipe a device until IT advises, unless you must to stop ongoing harm).",
            "Do not attempt to “test” security controls in ways that disrupt school operations or access someone else’s account.",
            "If equipment theft is involved, follow school theft/police procedure in parallel.",
          ]}
        />
        <p>
          Operators will prioritize identity and data-exposure issues,
          rotate secrets if needed, and work with the division on staff
          notification if LA FOIP or board policy requires it.
        </p>
      </LegalSection>

      <LegalSection title="16. Vulnerability disclosure">
        <p>
          If you believe you have found a security issue in {LEGAL_PRODUCT}{" "}
          (authentication bypass, data exposure, injection, privilege
          escalation, leaked secrets, or similar):
        </p>
        <LegalList
          items={[
            "Do not open a public issue with exploit details.",
            "Do not run destructive tests, ransomware simulations, or load tests against production.",
            "Contact IT / the repository operators privately with a description, impact, steps to reproduce, affected URL or environment, and a way to reach you.",
            "Allow a reasonable time to mitigate before any public discussion.",
          ]}
        />
        <p>
          Out of scope examples include issues that only affect a
          misconfigured local demo, social engineering of Workspace admins,
          and vulnerabilities that exist solely in a third-party provider and
          should be reported upstream.
        </p>
      </LegalSection>

      <LegalSection title="17. Shared responsibility">
        <p>Security is shared.</p>
        <LegalSubheading>Platform operators</LegalSubheading>
        <LegalList
          items={[
            "Application access rules, RLS, secret handling, HTTPS hosting, and dependency updates.",
            "Responding to disclosed vulnerabilities and rotating exposed credentials.",
            "Keeping production free of demo-login and other insecure flags.",
          ]}
        />
        <LegalSubheading>School division</LegalSubheading>
        <LegalList
          items={[
            "Google Workspace security (2-step verification, offboarding, phishing training).",
            "Allowlist accuracy when staff are hired, transferred, or released.",
            "Device policy, network filtering, and physical custody of carts.",
            "DNS authentication for school mail (SPF/DKIM/DMARC) and review of vendor arrangements under LA FOIP.",
            "Local acceptable-use enforcement and HR processes.",
          ]}
        />
        <LegalSubheading>Individual users</LegalSubheading>
        <LegalList
          items={[
            "Protecting sign-in sessions and devices.",
            "Entering only appropriate operational data.",
            "Reporting problems instead of working around controls.",
          ]}
        />
      </LegalSection>

      <LegalSection title="18. What this statement does not claim">
        <LegalList
          items={[
            "Cubicle does not claim ISO 27001, SOC 2, or similar certification of its own as a product.",
            "Cubicle does not claim that email will always reach the inbox or that spam filters will never quarantine operational mail.",
            "Cubicle does not claim zero downtime, perfect realtime delivery, or that a booked slot guarantees physically working hardware.",
            "Managed providers’ own certifications apply to those providers, not automatically to every school workflow built on top of them.",
            "A website TLS certificate proves the browser is talking to our host; it is not an email BIMI identity certificate and not a substitute for staff verification of phishing.",
          ]}
        />
      </LegalSection>

      <LegalSection title="19. Contact">
        <p>
          Security concerns, suspected incidents, and vulnerability reports:
        </p>
        <p>
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>
        </p>
        <p>
          Related documents:{" "}
          <a href="/legal/terms">Terms &amp; Conditions</a>,{" "}
          <a href="/legal/privacy">Privacy Policy</a>,{" "}
          <a href="/legal/acceptable-use">Acceptable Use Policy</a>.
        </p>
      </LegalSection>
    </LegalShell>
  );
}

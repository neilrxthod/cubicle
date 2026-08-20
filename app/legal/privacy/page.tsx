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
  LEGAL_DOMAIN,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_PRODUCT,
  LEGAL_SCHOOL_DOMAIN,
} from "@/lib/legal/constants";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "Privacy Policy",
  description: `How ${LEGAL_PRODUCT} collects, uses, discloses, retains, and protects personal information of authorized school staff.`,
  path: "/legal/privacy",
});

const TOC = [
  { href: "#1-introduction", label: "1. Introduction" },
  { href: "#2-who-we-are-and-roles", label: "2. Who we are and roles" },
  { href: "#3-scope", label: "3. Scope" },
  { href: "#4-categories-of-information-we-process", label: "4. Categories of information we process" },
  { href: "#5-how-we-collect-information", label: "5. How we collect information" },
  { href: "#6-purposes-of-processing", label: "6. Purposes of processing" },
  { href: "#7-legal-and-operational-basis", label: "7. Legal and operational basis" },
  { href: "#8-access-controls-and-minimization", label: "8. Access controls and minimization" },
  { href: "#9-sharing-and-processors", label: "9. Sharing and processors" },
  { href: "#10-email-and-notifications", label: "10. Email and notifications" },
  { href: "#11-cookies-local-storage-and-similar-technologies", label: "11. Cookies, local storage, and similar technologies" },
  { href: "#12-presence-realtime-and-device-features", label: "12. Presence, realtime, and device features" },
  { href: "#13-retention-and-disposal", label: "13. Retention and disposal" },
  { href: "#14-security-of-personal-information", label: "14. Security of personal information" },
  { href: "#15-your-choices-and-rights", label: "15. Your choices and rights" },
  { href: "#16-children-and-student-information", label: "16. Children and student information" },
  { href: "#17-international-and-cross-border-processing", label: "17. International and cross-border processing" },
  { href: "#18-automated-processing", label: "18. Automated processing" },
  { href: "#19-policy-updates", label: "19. Policy updates" },
  { href: "#20-complaints-and-contact", label: "20. Complaints and contact" },
] as const;

export default function PrivacyPage() {
  return (
    <LegalShell
      title="Privacy Policy"
      description={`This Privacy Policy explains what personal information ${LEGAL_PRODUCT} processes, why it is processed, who it is shared with, how long it is kept, and how authorized school staff can make requests.`}
      effectiveDate={LEGAL_EFFECTIVE_DATE}
    >
      <LegalToc items={TOC} />

      <LegalSection title="1. Introduction">
        <p>
          {LEGAL_PRODUCT} (“we”, “the platform”) is a school operations
          application used by authorized staff. This Privacy Policy describes
          how personal information is collected, used, disclosed, stored,
          protected, and disposed of in connection with {LEGAL_DOMAIN}.
        </p>
        <p>
          It should be read together with the{" "}
          <a href="/legal/terms">Terms &amp; Conditions</a>,{" "}
          <a href="/legal/acceptable-use">Acceptable Use Policy</a>, and{" "}
          <a href="/legal/security">Security &amp; Data Safety</a> statement.
          Division IT, privacy, and legal contacts should review this policy
          before formal board or division-wide adoption.
        </p>
        <p>
          This policy is written for staff users and for the school division as
          a local authority. It is not a consumer privacy notice for a public
          social network, and it is not a substitute for the division’s own
          LA FOIP procedures.
        </p>
      </LegalSection>

      <LegalSection title="2. Who we are and roles">
        <p>
          The participating school division determines the purposes for which
          staff operational data is collected in {LEGAL_PRODUCT} (who may
          book carts, which emails are allowlisted, how long records are kept
          for school operations). In that sense the division is the primary
          public body responsible for personal information under Saskatchewan
          local-authority privacy law.
        </p>
        <p>
          Operators of {LEGAL_PRODUCT} process that information on the
          division’s behalf to run the application: authentication, database
          hosting, application delivery, email notifications, and related
          technical support. Individual users (teachers and admins) also
          enter information in the course of their duties.
        </p>
        <p>
          Privacy questions, access requests, and correction requests should
          ordinarily go to the school division’s privacy contact / IT, who
          can involve the platform operators as needed. Contact:{" "}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
        </p>
      </LegalSection>

      <LegalSection title="3. Scope">
        <p>
          This policy applies to {LEGAL_PRODUCT} available at {LEGAL_DOMAIN},
          including the signed-in application, public legal and about pages,
          sign-in flows, and operational email sent by the platform.
        </p>
        <LegalList
          items={[
            "It covers staff users (teachers and IT/admin personnel) and technical data about their use of the service.",
            "It does not cover websites, Google Workspace itself, or other school systems that are not part of Cubicle.",
            "Local developer sandboxes (isolated demo data on a personal computer) are not production school records and are outside the production data store.",
            "Public marketing pages, if any, collect only what is technically required to serve the page (for example standard web logs at the host).",
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Categories of information we process">
        <p>
          The platform is designed around staff operational data. Depending on
          how you and administrators use the service, we may process the
          following categories.
        </p>
        <LegalSubheading>Identity and account</LegalSubheading>
        <LegalList
          items={[
            "Name, school email address, and profile photo URL provided by Google Sign-In when you authenticate.",
            "Assigned role (teacher or admin) and allowlist membership.",
            "Employment type where recorded (for example permanent, temporary, or substitute).",
            "Verified-staff badge state if an administrator grants or removes it.",
            "Optional profile fields you save (title, department, phone, bio, avatar if uploaded or mapped from Google).",
          ]}
        />
        <LegalSubheading>Operational school records</LegalSubheading>
        <LegalList
          items={[
            "Cart bookings (cart, date, period, class or purpose labels, notes you enter, share and swap relationships).",
            "Share invites (pending, accepted, declined) and related staff identifiers.",
            "Swap or handoff requests, reasons you provide, and outcomes.",
            "Equipment issue reports (cart, severity, description, status, timestamps).",
            "Slot restrictions and booking-policy settings configured by administrators.",
            "Cart inventory fields (name, location, status, laptop brand, counts, QR / laptop codes).",
            "Admin actions such as reassignment, cancellation with a reason, or cart pause/maintenance.",
          ]}
        />
        <LegalSubheading>Technical and security data</LegalSubheading>
        <LegalList
          items={[
            "Authentication events, session establishment, and failed or rejected sign-in outcomes (for example wrong domain or not allowlisted).",
            "Application error diagnostics needed to keep the service available.",
            "Coarse presence information used to show whether a colleague appears signed in (not a precise GPS location).",
            "Browser storage used to keep the board responsive (a local cache of school operational data for the signed-in app).",
            "Standard hosting logs that a cloud provider may retain (IP address, user agent, request time) under that provider’s terms.",
          ]}
        />
        <LegalSubheading>Notification preferences</LegalSubheading>
        <LegalList
          items={[
            "Your choices about operational email (for example share, swap, cancellation, or issue notices).",
            "Records of test-email requests you initiate from Settings, used only to confirm that mail can be delivered to your school address.",
          ]}
        />
        <p>
          {LEGAL_PRODUCT} is not intended to collect student personal
          education records, health information, or payment card data as a
          primary purpose. Avoid entering those categories in free-text
          fields.
        </p>
      </LegalSection>

      <LegalSection title="5. How we collect information">
        <LegalList
          items={[
            "Directly from you when you sign in, update Settings, book a cart, report an issue, request a share or swap, or scan a QR label.",
            "From Google as identity provider when you complete school Workspace sign-in (name, email, and photo URL as Google provides them).",
            "From administrators when they add or edit allowlist entries, roles, inventory, restrictions, or take action on bookings.",
            "Automatically from the application and infrastructure when you use the service (authentication, realtime updates, error logs, presence).",
            "From the email delivery provider when we send operational mail and, if you run a test send, limited delivery-event status for that message.",
          ]}
        />
        <p>
          We do not buy staff lists from data brokers. Allowlist records are
          created by the school division.
        </p>
      </LegalSection>

      <LegalSection title="6. Purposes of processing">
        <p>We process personal information only as needed to:</p>
        <LegalList
          items={[
            "Authenticate users and enforce school-domain and allowlist access controls.",
            "Display names, roles, and avatars so colleagues can identify who booked a cart or reported an issue.",
            "Provide booking boards, schedules, maintenance status, share/swap workflows, and admin tooling.",
            "Send operational email related to carts, issues, and account activity, and honour notification preferences.",
            "Maintain security, prevent abuse, investigate incidents, and diagnose service problems.",
            "Meet school division record-keeping, audit, and equipment-coordination needs.",
            "Improve reliability (for example reconciling live board data so other staff see bookings without a full page reload).",
          ]}
        />
        <p>
          We do not use staff operational data to serve third-party advertising,
          and we do not sell personal information.
        </p>
      </LegalSection>

      <LegalSection title="7. Legal and operational basis">
        <p>
          The participating school division is a local authority for the
          purposes of Saskatchewan’s{" "}
          <em>
            Local Authority Freedom of Information and Protection of Privacy
            Act
          </em>{" "}
          (“LA FOIP”). Personal information in {LEGAL_PRODUCT} is collected
          and used for the authorized school purpose of coordinating shared
          instructional technology and related staff operations.
        </p>
        <p>
          Processing is limited to what is needed for those purposes, for the
          protection of people and property (including equipment safety and
          abuse prevention), and for purposes consistent with those for which
          the information was obtained, as LA FOIP and division policy allow.
        </p>
        <p>
          Canada’s Anti-Spam Legislation (CASL) is relevant to commercial
          electronic messages. Operational notices about bookings, shares,
          swaps, cancellations, and equipment issues are transactional /
          service messages related to your use of a work tool, not marketing.
          You can reduce optional notification types in Settings.
        </p>
        <p>
          PIPEDA generally does not replace LA FOIP for a Saskatchewan school
          division acting as a public body. If a vendor processes information
          outside Saskatchewan, the division remains responsible for ensuring
          contractual and policy safeguards are adequate.
        </p>
      </LegalSection>

      <LegalSection title="8. Access controls and minimization">
        <LegalList
          items={[
            `Only @${LEGAL_SCHOOL_DOMAIN} Google accounts may authenticate.`,
            "An approved allowlist entry is required in addition to the school domain.",
            "Role-based access separates teacher and administrator capabilities (for example allowlist and fleet tools).",
            "Database row-level security (RLS) restricts what authenticated users can read or change.",
            "You should enter the minimum information needed for a booking or issue (class or purpose, not student files).",
            "Administrators should keep the allowlist current so former staff cannot sign in.",
          ]}
        />
        <p>
          Other signed-in staff can typically see operational booking and
          issue information that the board requires for a shared schedule
          (who has which cart in which period). Treat that visibility as
          workplace operational transparency, not a public directory.
        </p>
      </LegalSection>

      <LegalSection title="9. Sharing and processors">
        <p>
          We share personal information only as needed to operate the service,
          comply with law, or protect the school community. We use trusted
          infrastructure processors, currently including:
        </p>
        <LegalList
          items={[
            "Supabase — authentication, managed PostgreSQL database, and realtime change delivery.",
            "Google — identity provider for school Google Workspace sign-in.",
            "Vercel — application hosting, HTTPS delivery, and related platform logs.",
            "Brevo — transactional / operational email delivery when notifications are enabled.",
            "Domain name services (for example name.com or the division’s DNS host) — name resolution for the production host.",
          ]}
        />
        <p>
          These processors handle data under their agreements and security
          controls as needed to run the platform. They are not permitted to
          use school staff data to advertise to you.
        </p>
        <LegalSubheading>Other disclosures</LegalSubheading>
        <LegalList
          items={[
            "School administrators and designated IT staff, as required for operations and access management.",
            "Other authorized staff, to the extent the shared board, share/swap flows, or issue lists display operational fields.",
            "Law enforcement or regulators if required by law, court order, or to protect against serious harm.",
            "Professional advisors under confidentiality (for example legal counsel) if needed to operate or defend the service.",
          ]}
        />
        <p>
          We do not sell personal information, and we do not share it with
          third parties for their independent marketing.
        </p>
      </LegalSection>

      <LegalSection title="10. Email and notifications">
        <p>
          If email is configured, {LEGAL_PRODUCT} may send messages to your
          school address about events such as:
        </p>
        <LegalList
          items={[
            "A colleague sharing a cart slot with you, or a change to that invite.",
            "Swap or handoff requests and their outcomes.",
            "Cancellation, reassignment, or other material booking changes.",
            "Equipment issue reports (typically of interest to administrators).",
            "A test message you request from Settings to confirm delivery.",
          ]}
        />
        <p>
          Message content may include cart name, period, date, staff names, and
          a short operational summary. You can turn some categories off in
          Settings. Security, access, and administrative messages may still be
          sent. Delivery depends on the email provider, school spam filters,
          and DNS authentication for the sending domain; we cannot guarantee
          inbox placement.
        </p>
      </LegalSection>

      <LegalSection title="11. Cookies, local storage, and similar technologies">
        <p>
          {LEGAL_PRODUCT} uses technically necessary storage to keep you signed
          in and to make the schedule usable:
        </p>
        <LegalList
          items={[
            "Authentication cookies or tokens set by the identity provider so your session can be validated.",
            "Browser local storage (and similar) for a client cache of platform data so the board can update without reloading the tab.",
            "Preferences you set in the product (for example UI or notification-related flags stored on the device).",
            "A service worker / progressive web app cache on devices where that feature is enabled, to load the app shell.",
          ]}
        />
        <p>
          We do not use third-party advertising cookies or cross-site
          behavioural advertising pixels on {LEGAL_PRODUCT}. Clearing site
          data will sign you out and drop the local cache; production school
          records remain in the database.
        </p>
      </LegalSection>

      <LegalSection title="12. Presence, realtime, and device features">
        <p>
          To keep every open board accurate, the application subscribes to
          database change events and may show whether a colleague appears
          currently signed in. Presence is a coarse workplace signal, not a
          timesheet, not GPS tracking, and not proof of classroom location.
        </p>
        <p>
          Optional camera access on a phone is used only when you choose to
          scan a cart or laptop QR label. The image is processed to decode the
          code; it is not used to build a photo gallery of staff or students.
          You can deny camera permission and still use the rest of the
          product.
        </p>
      </LegalSection>

      <LegalSection title="13. Retention and disposal">
        <p>
          Operational records (bookings, issues, profiles, inventory) are
          retained while needed for school operations, troubleshooting,
          equipment history, and audit requirements. There is no automatic
          “right to be forgotten” that erases school operational history
          while you remain staff and the division still needs the record,
          except as LA FOIP and division records schedules provide.
        </p>
        <LegalList
          items={[
            "When an account is removed from the allowlist or access is revoked, sign-in is blocked.",
            "Administrators may clear or edit specific operational tables according to division practice (for example after a term, or when retiring a cart).",
            "You may ask IT to correct inaccurate profile fields or to remove optional information that is no longer needed.",
            "Backups and logs held by infrastructure providers are retained according to those providers’ cycles and then expire.",
            "Local browser caches can be deleted by signing out and clearing site data.",
          ]}
        />
        <p>
          Record retention and destruction schedules should follow school
          division policy. Platform operators will cooperate with documented
          IT requests to correct or remove specific records where technically
          feasible and lawful.
        </p>
      </LegalSection>

      <LegalSection title="14. Security of personal information">
        <p>
          We apply administrative and technical safeguards described in the{" "}
          <a href="/legal/security">Security &amp; Data Safety</a> statement,
          including encrypted transport (HTTPS), least-privilege credentials,
          allowlist enforcement, role-based authorization, and database row-level
          security. Service-role secrets are not shipped to the browser.
        </p>
        <p>
          No method of transmission or storage is perfectly secure. You must
          also protect your Google account, devices, and the information you
          type into free-text fields. Report suspected incidents promptly to{" "}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
        </p>
      </LegalSection>

      <LegalSection title="15. Your choices and rights">
        <LegalSubheading>Product choices</LegalSubheading>
        <LegalList
          items={[
            "Update profile details in Settings where the product allows it.",
            "Adjust optional email notification categories.",
            "Sign out on shared devices and clear site data if you used a public browser.",
            "Decline camera permission if you do not wish to scan QR labels.",
            "Contact IT to correct allowlist information or request account removal when you leave the school.",
          ]}
        />
        <LegalSubheading>Access and correction (LA FOIP)</LegalSubheading>
        <p>
          As a staff member of a Saskatchewan local authority, you may have
          rights to request access to personal information about you, and to
          request correction of inaccurate personal information, subject to
          exceptions in LA FOIP (for example other people’s information,
          security, or solicitor-client privilege).
        </p>
        <p>
          Submit requests through the school division’s established privacy
          process, or start with{" "}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
          We may need to verify that the request is from the individual
          concerned or an authorized representative. School operational
          records that are not “personal information” (or that contain mixed
          information about several staff) will be handled according to
          division FOI/LA FOIP procedures.
        </p>
      </LegalSection>

      <LegalSection title="16. Children and student information">
        <p>
          {LEGAL_PRODUCT} is directed to authorized adult staff users, not
          children, and not to students as account holders. It is not a
          general public social platform and is not a student information
          system.
        </p>
        <p>
          Do not enter student names, student numbers, medical notes,
          safeguarding reports, or other sensitive student identifiers into
          booking notes or issue descriptions unless a documented division
          procedure requires that specific field for the task. If such
          information is entered in error, notify IT so it can be removed.
        </p>
      </LegalSection>

      <LegalSection title="17. International and cross-border processing">
        <p>
          Infrastructure providers may process or store data in Canada, the
          United States, or other regions depending on service configuration
          (for example application hosting, database, authentication, or
          email). Where personal information may leave Saskatchewan or
          Canada, the school division remains responsible for ensuring that
          vendor arrangements and contractual protections meet its privacy
          obligations.
        </p>
        <p>
          Staff should assume that operational records are stored on managed
          cloud infrastructure, not only on a server physically located in
          the school building.
        </p>
      </LegalSection>

      <LegalSection title="18. Automated processing">
        <p>
          {LEGAL_PRODUCT} uses automated rules for operational consistency,
          for example:
        </p>
        <LegalList
          items={[
            "Rejecting sign-in when the email domain is not the school domain or the address is not allowlisted.",
            "Enforcing booking windows, slot limits, and locked periods configured by administrators.",
            "Placing a cart into maintenance when a high-severity issue is reported, where that database rule is enabled.",
            "Updating open boards when another user changes a booking (realtime sync).",
          ]}
        />
        <p>
          These rules are not consumer credit scoring and are not used to
          profile staff for advertising. They can have workplace effects
          (you cannot book a locked slot; a cart may be pulled from
          circulation). Speak with an administrator if you believe a rule
          was applied in error.
        </p>
      </LegalSection>

      <LegalSection title="19. Policy updates">
        <p>
          We may update this Privacy Policy to reflect product, legal, or
          operational changes. The effective date at the top will be revised
          when changes are published on {LEGAL_DOMAIN}. Material changes to
          purposes or categories of personal information should be reviewed
          with division privacy contacts. Continued use of the service after
          the new effective date constitutes awareness of the updated policy.
        </p>
      </LegalSection>

      <LegalSection title="20. Complaints and contact">
        <p>
          For privacy questions, access or correction requests, or concerns
          about how {LEGAL_PRODUCT} handles personal information, contact
          your school division IT / privacy contact:
        </p>
        <p>
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>
        </p>
        <p>
          If you are not satisfied with the division’s response, Saskatchewan
          law may allow you to contact the Saskatchewan Information and
          Privacy Commissioner. Use the Commissioner’s published process.
          We encourage you to raise the issue with the division first so it
          can be investigated quickly.
        </p>
      </LegalSection>
    </LegalShell>
  );
}

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
  LEGAL_OWNER,
  LEGAL_PRODUCT,
  LEGAL_SCHOOL_DOMAIN,
} from "@/lib/legal/constants";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "Terms & Conditions",
  description: `Terms and conditions governing access to and use of ${LEGAL_PRODUCT} by authorized school staff.`,
  path: "/legal/terms",
});

const TOC = [
  { href: "#1-introduction-and-binding-agreement", label: "1. Introduction and binding agreement" },
  { href: "#2-definitions", label: "2. Definitions" },
  { href: "#3-the-service", label: "3. The service" },
  { href: "#4-eligibility-and-authorized-users", label: "4. Eligibility and authorized users" },
  { href: "#5-accounts-authentication-and-sessions", label: "5. Accounts, authentication, and sessions" },
  { href: "#6-licence-and-intellectual-property", label: "6. Licence and intellectual property" },
  { href: "#6a-no-copying-cloning-or-similar-products", label: "6A. No copying, cloning, or similar products" },
  { href: "#7-your-responsibilities", label: "7. Your responsibilities" },
  { href: "#8-school-records-and-user-content", label: "8. School records and user content" },
  { href: "#9-bookings-inventory-and-operational-fairness", label: "9. Bookings, inventory, and operational fairness" },
  { href: "#10-communications-and-notices", label: "10. Communications and notices" },
  { href: "#11-privacy-and-related-policies", label: "11. Privacy and related policies" },
  { href: "#12-availability-maintenance-and-changes", label: "12. Availability, maintenance, and changes" },
  { href: "#13-third-party-services", label: "13. Third-party services" },
  { href: "#14-disclaimers-of-warranties", label: "14. Disclaimers of warranties" },
  { href: "#15-limitation-of-liability", label: "15. Limitation of liability" },
  { href: "#16-indemnification", label: "16. Indemnification" },
  { href: "#17-suspension-and-termination", label: "17. Suspension and termination" },
  { href: "#18-changes-to-these-terms", label: "18. Changes to these terms" },
  { href: "#19-governing-law-and-disputes", label: "19. Governing law and disputes" },
  { href: "#20-general-provisions", label: "20. General provisions" },
  { href: "#21-assumption-of-risk-releases-and-claims", label: "21. Assumption of risk, releases, and claims" },
  { href: "#22-injunctive-relief-and-equitable-remedies", label: "22. Injunctive relief and equitable remedies" },
  { href: "#23-contact", label: "23. Contact" },
] as const;

export default function TermsPage() {
  return (
    <LegalShell
      title="Terms & Conditions"
      description={`These Terms and Conditions govern access to and use of ${LEGAL_PRODUCT} (${LEGAL_DOMAIN}), a school resource scheduling platform for authorized staff of the participating school division.`}
      effectiveDate={LEGAL_EFFECTIVE_DATE}
    >
      <LegalToc items={TOC} />

      <LegalSection title="1. Introduction and binding agreement">
        <p>
          These Terms and Conditions (the “Terms”) form a legally binding
          agreement between you and the operators of {LEGAL_PRODUCT} for the
          participating school division. By creating a session, signing in,
          clicking to accept, or otherwise accessing or using {LEGAL_PRODUCT},
          you agree to these Terms, the{" "}
          <a href="/legal/privacy">Privacy Policy</a>, the{" "}
          <a href="/legal/intellectual-property">
            Intellectual Property &amp; Licence
          </a>{" "}
          policy, the{" "}
          <a href="/legal/security">Security &amp; Data Safety</a> statement,
          and the <a href="/legal/acceptable-use">Acceptable Use Policy</a>{" "}
          (together, the “Policies”). If you do not agree, you must not access
          or use the platform.
        </p>
        <p>
          {LEGAL_PRODUCT} is an internal school operations tool. It is not a
          consumer product, not a public booking marketplace, and not a
          substitute for official student information systems, emergency
          notification systems, payroll, or human-resources systems of record.
        </p>
        <p>
          If you use {LEGAL_PRODUCT} in the course of your employment or
          assignment with the school division, you represent that you are
          authorized to do so and that you will comply with division board
          policy, local school rules, and applicable law in addition to these
          Terms.
        </p>
      </LegalSection>

      <LegalSection title="2. Definitions">
        <p>In these Terms:</p>
        <LegalList
          items={[
            `“${LEGAL_PRODUCT}”, “the platform”, or “the service” means the web application available at ${LEGAL_DOMAIN}, including related application programming interfaces, email notifications, progressive web app features, and administrative tools.`,
            "“You” or “user” means the individual accessing the platform.",
            "“School division” or “division” means the participating board of education / school division that authorizes staff use of the platform.",
            "“IT” means school division information technology staff or the designated platform operators.",
            "“Allowlist” means the approved list of school email addresses permitted to sign in, together with assigned roles.",
            "“Admin” means a user whose allowlist or profile role is administrator.",
            "“Teacher” means a user whose role is teacher (including substitute, temporary, or permanent instructional staff as classified in the platform).",
            "“Content” means text, names, booking details, issue reports, laptop codes, profile fields, and other information you submit or that is generated about your use of the service.",
            "“School records” means operational records created in the platform, including bookings, cart inventory, restrictions, issues, swap and share requests, and staff directory fields.",
            `“Owner” means ${LEGAL_OWNER}, the person or entity that created, owns, and operates ${LEGAL_PRODUCT}, including all software, design, and related intellectual property.`,
            "“Similar product” means any application, site, script, or system that copies, remakes, replaces, or is modelled on Cubicle, including with a different user interface, name, or feature set.",
          ]}
        />
      </LegalSection>

      <LegalSection title="3. The service">
        <p>
          {LEGAL_PRODUCT} provides tools for authorized staff to coordinate
          shared instructional technology, currently including:
        </p>
        <LegalList
          items={[
            "A daily schedule board for booking laptop carts against class periods and dates.",
            "Share invites and swap or handoff requests between staff for booked slots.",
            "Equipment issue reporting, including severity that may place a cart in maintenance.",
            "Admin inventory (cart names, locations, laptop brand and counts, QR / laptop codes).",
            "Slot restrictions and booking-window policy (for example locking periods for exams).",
            "Staff allowlist, roles, employment type, and related access administration.",
            "Optional operational email notifications (shares, swaps, cancellations, issue reports).",
            "Optional device features such as QR scanning of cart or laptop labels.",
          ]}
        />
        <p>
          Features may be added, changed, limited by role, or withdrawn. The
          service is provided only for legitimate school operations. We do not
          promise that any particular feature will remain available in the same
          form.
        </p>
      </LegalSection>

      <LegalSection title="4. Eligibility and authorized users">
        <p>
          {LEGAL_PRODUCT} is provided solely for authorized personnel of the
          participating school division. Access is a privilege tied to
          employment or assignment, not a personal right that travels with a
          private email account.
        </p>
        <LegalSubheading>Access conditions</LegalSubheading>
        <LegalList
          items={[
            `Google accounts must use the school Workspace domain @${LEGAL_SCHOOL_DOMAIN}.`,
            "Personal accounts (including Gmail and other consumer domains) are prohibited.",
            "A school-domain account is not sufficient by itself. The exact email must appear on the IT allowlist before access is granted.",
            "Roles (teacher or admin) are assigned by authorized administrators, not self-selected by end users.",
            "Students, parents, the general public, vendors without written authorization, and former staff who have been removed from the allowlist are not eligible users.",
          ]}
        />
        <p>
          Circumventing eligibility (for example forwarding a school inbox to a
          personal account and attempting sign-in, sharing a colleague’s
          session, or using an unauthorized Google identity) is a material
          breach of these Terms and of the Acceptable Use Policy.
        </p>
      </LegalSection>

      <LegalSection title="5. Accounts, authentication, and sessions">
        <p>
          Production authentication is performed with school Google Sign-In
          through our identity provider. {LEGAL_PRODUCT} does not issue a
          separate production password for Google-authenticated staff.
        </p>
        <LegalList
          items={[
            "You must protect your school Google credentials, recovery methods, and signed-in devices.",
            "You must not share your account, browser profile, session cookies, or QR-login state with another person.",
            "You are responsible for activity conducted under your authenticated session until you sign out or IT revokes access.",
            "You must sign out on shared, classroom, or unattended devices.",
            "We may terminate sessions, refuse sign-in, or remove an unauthorized identity when domain, allowlist, or security checks fail.",
            "We may suspend or revoke access for security, policy, inactivity, or employment-status reasons, including when you leave the school or change assignment.",
          ]}
        />
        <p>
          If you believe your Google account or a {LEGAL_PRODUCT} session has
          been used without authorization, sign out, secure the Google account,
          and notify IT immediately at{" "}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
        </p>
      </LegalSection>

      <LegalSection title="6. Licence and intellectual property">
        <p>
          Subject to these Terms and the{" "}
          <a href="/legal/intellectual-property">
            Intellectual Property &amp; Licence
          </a>{" "}
          policy (which is incorporated here in full), you receive a limited,
          non-exclusive, non-transferable, non-sublicensable, non-assignable,
          revocable right to access and use the live {LEGAL_PRODUCT} service
          solely for legitimate school operations while you remain an
          authorized user. That is a licence to use, not a sale, and not a
          transfer of any intellectual-property right.
        </p>
        <p>
          All software, visual design, wordmark, documentation, workflows,
          QR and label designs, source, and know-how in {LEGAL_PRODUCT} are
          owned exclusively by {LEGAL_OWNER}. The participating school
          division is a licensee only. Use, hosting of school data, feature
          requests, or internal listing of the tool does not make the
          division, any staff member, or any vendor an owner or co-author.
        </p>
        <LegalList
          items={[
            "No assignment of Cubicle occurs unless the Owner signs a written instrument that expressly assigns identified rights.",
            "You may not remove proprietary notices or use the Cubicle name or marks to suggest unauthorized endorsement or that another product is Cubicle.",
            "School records you enter remain school division operational records; the licence above does not transfer those records to you personally, and it does not transfer the software to the division.",
            "Feedback is assigned to the Owner as described in the IP Policy. Suggesting a feature does not make you a co-author.",
            "Moral rights in feedback are waived to the extent permitted by the Copyright Act (Canada) and other applicable law.",
          ]}
        />
      </LegalSection>

      <LegalSection title="6A. No copying, cloning, or similar products">
        <p>
          Without the Owner’s prior explicit written permission, you — and
          the school division — must not copy, sell, remake, reverse
          engineer, open-source, or create a Similar product, including one
          with a different user interface, different features, different
          name, or different branding.
        </p>
        <p>
          You must not take inspiration from {LEGAL_PRODUCT} to brief a
          vendor, intern, or staff developer; use screenshots or walkthroughs
          as a specification; or write an RFP that restates Cubicle in other
          words. Changing colours or “rewriting it in another stack” is not
          a defence. Details and remedies are in the{" "}
          <a href="/legal/intellectual-property">
            Intellectual Property &amp; Licence
          </a>{" "}
          policy. Those rules survive after you stop using the service.
        </p>
      </LegalSection>

      <LegalSection title="7. Your responsibilities">
        <p>You agree that you will:</p>
        <LegalList
          items={[
            "Use the platform only for school-related scheduling, inventory, and related operational tasks.",
            "Provide accurate booking details (date, period, class or purpose, and any share or swap information).",
            "Cancel or release bookings you no longer need so other staff can use shared equipment.",
            "Report equipment problems truthfully and with an appropriate severity.",
            "Keep profile information reasonably current (name as used at school, contact details you choose to store).",
            "Treat staff names, booking patterns, inventory, laptop codes, and issue notes as confidential school operational information.",
            "Comply with the Acceptable Use Policy, Security & Data Safety statement, and applicable division technology policies.",
            "Avoid entering student personal information, medical information, or other sensitive identifiers unless a documented division procedure requires it for the specific task.",
          ]}
        />
      </LegalSection>

      <LegalSection title="8. School records and user content">
        <p>
          Booking records, issue reports, profile fields, laptop codes, share
          and swap requests, restrictions, and related operational data are
          school division records processed to deliver the service. They are
          not your personal cloud storage.
        </p>
        <p>
          You retain responsibility for the accuracy of information you enter.
          Admins may view, edit, reassign, restrict, or delete operational
          records as required for fleet management, fairness, safety, or
          policy. We may also process records as described in the Privacy
          Policy.
        </p>
        <p>
          You grant the operators of {LEGAL_PRODUCT} a worldwide, royalty-free
          licence to host, store, display, transmit, and otherwise process
          Content solely to operate, secure, and improve the service for the
          school division. This licence ends when the Content is deleted from
          the production systems in accordance with retention practice, except
          for copies remaining in backups for a limited period or as required
          by law.
        </p>
      </LegalSection>

      <LegalSection title="9. Bookings, inventory, and operational fairness">
        <p>
          Shared carts are a limited school resource. Booking a slot does not
          transfer ownership of equipment. Teachers should book only what they
          reasonably need for instruction or approved school activity.
        </p>
        <LegalList
          items={[
            "Booking windows, daily slot limits, and locked periods (for example exams) may be enforced by policy configured by administrators.",
            "Admins may cancel, reassign, or delete bookings — including bookings created by other staff — when required for operations, maintenance, or policy.",
            "Share invites and swap requests create operational obligations: respond promptly and do not use them to circumvent slot limits in bad faith.",
            "Placing a cart in maintenance, locking slots, or changing inventory may affect existing classroom plans. Admins should use those tools in good faith.",
            "QR labels and laptop codes are inventory controls. Do not republish them publicly or use them to impersonate equipment custody.",
          ]}
        />
        <p>
          {LEGAL_PRODUCT} does not guarantee that a cart will be physically
          present, fully charged, or free of defects merely because a slot
          appears booked or available in software. Physical custody, charging,
          and classroom supervision remain school operational matters.
        </p>
      </LegalSection>

      <LegalSection title="10. Communications and notices">
        <p>
          We may send operational notices through the platform interface, to
          your school email address, or through other channels designated by
          IT. Email about shares, swaps, cancellations, issue reports, and
          similar events is part of the service. You may adjust some
          notification preferences in Settings, but we may still send messages
          required for security, access, or administration.
        </p>
        <p>
          Notices under these Terms are effective when posted in the service or
          sent to the school email on your allowlist record. You are
          responsible for reading notices sent to that address.
        </p>
      </LegalSection>

      <LegalSection title="11. Privacy and related policies">
        <p>
          Processing of personal information is described in the{" "}
          <a href="/legal/privacy">Privacy Policy</a>. Ownership and
          copying rules are in the{" "}
          <a href="/legal/intellectual-property">
            Intellectual Property &amp; Licence
          </a>{" "}
          policy. Security practices are described in the{" "}
          <a href="/legal/security">Security &amp; Data Safety</a> statement.
          Conduct rules are in the{" "}
          <a href="/legal/acceptable-use">Acceptable Use Policy</a>. Those
          documents are incorporated into these Terms by reference.
        </p>
        <p>
          If there is a conflict between a summary in these Terms and the
          Privacy Policy on a privacy-specific point, the Privacy Policy
          controls for that point. If there is a conflict between these Terms
          and mandatory law or binding board policy, the mandatory rule
          prevails.
        </p>
      </LegalSection>

      <LegalSection title="12. Availability, maintenance, and changes">
        <p>
          We aim for reliable availability during school operations but do not
          guarantee uninterrupted, error-free, or timely operation. The
          platform may be unavailable because of maintenance, hosting or
          identity-provider outages, network issues, configuration changes,
          force majeure, or security response.
        </p>
        <p>
          Features, interfaces, booking rules, and integrations may be updated,
          suspended, or discontinued as needed for maintenance, security,
          legal, or operational improvement. Where practical, material changes
          that affect day-to-day classroom booking will be communicated to
          administrators.
        </p>
        <p>
          You are responsible for maintaining an alternative classroom plan if
          a cart cannot be booked or the service is temporarily unavailable.
        </p>
      </LegalSection>

      <LegalSection title="13. Third-party services">
        <p>
          {LEGAL_PRODUCT} depends on third-party infrastructure, currently
          including identity and database services, application hosting, DNS,
          email delivery, and Google Workspace sign-in. Those providers have
          their own terms and availability. We are not responsible for outages,
          policy changes, or acts of third parties outside our reasonable
          control.
        </p>
        <p>
          Links to third-party sites (for example a mail provider dashboard)
          are provided for convenience. Those sites are not part of{" "}
          {LEGAL_PRODUCT} and are not covered by these Terms.
        </p>
      </LegalSection>

      <LegalSection title="14. Disclaimers of warranties">
        <p>
          {LEGAL_PRODUCT} is provided on an “as is” and “as available” basis
          for school operational use. To the fullest extent permitted by
          applicable law, {LEGAL_OWNER} and the operators of {LEGAL_PRODUCT}{" "}
          disclaim all warranties and conditions, whether express, implied,
          statutory, or otherwise, including implied warranties of
          merchantability, merchantable quality, fitness for a particular
          purpose, title, quiet enjoyment, and non-infringement, and any
          warranties arising from course of dealing or usage of trade. There
          is no service-level agreement unless the Owner signs one.
        </p>
        <p>
          Without limiting the foregoing, we do not warrant that:
        </p>
        <LegalList
          items={[
            "The service will meet every instructional or administrative requirement.",
            "Booked equipment will be physically available, safe, or in working order.",
            "The service will be uninterrupted, timely, secure, or free of defects or harmful components.",
            "Data will never be lost, delayed, or displayed incorrectly.",
            "Email notifications will be delivered, or will land in an inbox rather than a junk folder.",
          ]}
        />
        <p>
          The platform is not a substitute for emergency communication, 911,
          lock-down procedures, official student cumulative files, or
          professional IT asset-management systems of record beyond the
          operational inventory it maintains.
        </p>
      </LegalSection>

      <LegalSection title="15. Limitation of liability">
        <p>
          To the fullest extent permitted by applicable law, {LEGAL_PRODUCT}{" "}
          and its operators, contributors, and hosting or identity providers
          shall not be liable for any indirect, incidental, special,
          consequential, exemplary, or punitive damages, or for any loss of
          data, goodwill, revenue, anticipated savings, or business
          interruption, or for the cost of substitute services, arising out of
          or related to these Terms or use of (or inability to use) the
          platform, even if advised of the possibility of such damages.
        </p>
        <p>
          To the fullest extent permitted by law, the aggregate liability of
          {LEGAL_OWNER} and of the operators of {LEGAL_PRODUCT} arising out of
          or related to the service shall not exceed the greater of (a) the
          amounts (if any) actually paid to the Owner specifically as a
          software licence fee in the twelve (12) months before the claim or
          (b) one hundred Canadian dollars (CAD $100). If the platform is
          provided without a separate licence fee to the division, clause (b)
          applies. That cap is the total for all claims together, not per
          incident.
        </p>
        <p>
          Without limiting the foregoing, the Owner is not liable for lost
          instruction time, failed lessons, missed bookings, substitute-teacher
          costs, equipment theft, student injury involving devices, FOI/LA FOIP
          complaints arising from how the division uses the tool, or claims by
          parents, students, or unions relating to classroom operations.
        </p>
        <p>
          Nothing in these Terms excludes or limits liability that cannot be
          excluded or limited under applicable law, including liability for
          fraud or for death or personal injury caused by negligence where such
          exclusion is prohibited.
        </p>
        <p>
          These limitations allocate risk between the school division (which
          controls staff, devices, classrooms, and records practice) and the
          Owner. You and the division acknowledge that this allocation is a
          material condition of providing the service, including where no
          licence fee is charged.
        </p>
        <p>
          Claims against hosting, identity, or email providers are subject to
          those providers’ terms. The Owner is not their insurer.
        </p>
      </LegalSection>

      <LegalSection title="16. Indemnification">
        <p>
          To the extent permitted by law and by your employment relationship
          with the school division, you will indemnify, defend, and hold
          harmless {LEGAL_OWNER} and the operators of {LEGAL_PRODUCT} from
          and against claims, damages, losses, and reasonable expenses
          (including legal fees) arising out of your breach of these Terms or
          the IP Policy, your misuse of the service, unauthorized copying or
          commissioning of a Similar product, or Content you submit that is
          unlawful or infringes the rights of others, except to the extent
          caused by the Owner’s gross negligence or wilful misconduct.
        </p>
        <p>
          The participating school division will indemnify and hold harmless
          the Owner from claims by staff, students, parents, unions, or
          third parties arising out of classroom operations, equipment
          custody, employment decisions, allowlist decisions, or the
          division’s use of {LEGAL_PRODUCT}, to the extent the division may
          lawfully give that indemnity as a public body. This is not intended
          to waive statutory duties the division owes under LA FOIP or
          education legislation; it is intended to keep product-liability and
          IP disputes from being shifted onto the Owner for the division’s
          operational choices.
        </p>
      </LegalSection>

      <LegalSection title="17. Suspension and termination">
        <p>Your right to use {LEGAL_PRODUCT} ends when any of the following occurs:</p>
        <LegalList
          items={[
            "Your employment, contract, or school assignment ends.",
            "You are removed from the allowlist or your role is revoked.",
            "Your school Google account is disabled or you no longer control the allowlisted address.",
            "You materially breach these Terms or the Acceptable Use Policy.",
            "IT suspends access as a security, investigative, or policy measure.",
            "The school division or operators discontinue the service.",
          ]}
        />
        <p>
          Upon termination, you must stop using the platform. We may
          immediately invalidate sessions. School records may be retained or
          deleted according to the Privacy Policy and division records
          practice. Survival: sections concerning intellectual property,
          the IP Policy, confidentiality, school records, disclaimers,
          limitation of liability, indemnification, assumption of risk,
          injunctive relief, governing law, and general provisions survive
          termination. You still may not copy or remake Cubicle after access
          ends.
        </p>
      </LegalSection>

      <LegalSection title="18. Changes to these terms">
        <p>
          We may revise these Terms to reflect product, legal, or operational
          changes. The effective date at the top of this page will be updated
          when a revision is published at {LEGAL_DOMAIN}. Continued use after
          the effective date constitutes acceptance of the revised Terms.
          If you do not agree, you must stop using the platform and ask IT to
          remove your access.
        </p>
        <p>
          For material changes that expand how school personal information is
          used, we will also update the Privacy Policy. Division IT, privacy,
          and legal contacts should review published Policies before formal
          board or division-wide adoption.
        </p>
      </LegalSection>

      <LegalSection title="19. Governing law and disputes">
        <p>
          {LEGAL_PRODUCT} is operated for school use in Saskatchewan, Canada.
          These Terms and the Policies are governed by the laws of the
          Province of Saskatchewan and the federal laws of Canada applicable
          therein, without regard to conflict-of-law rules that would apply
          another jurisdiction’s laws.
        </p>
        <p>
          Subject to any mandatory dispute process in employment or board
          policy, the courts of Saskatchewan (and, where they have
          jurisdiction, the Federal Court of Canada for intellectual-property
          matters) have exclusive jurisdiction over disputes arising out of
          these Terms, except that the Owner may seek injunctive or other
          equitable relief in any forum to protect {LEGAL_PRODUCT},
          confidential information, or school data.
        </p>
        <p>
          You waive, to the extent permitted, any right to participate in a
          class, collective, or representative proceeding against the Owner
          relating to the service. Each claim must be brought in an
          individual capacity.
        </p>
        <p>
          Use is also subject to applicable school division policies,
          provincial education requirements,{" "}
          <em>The Local Authority Freedom of Information and Protection of
          Privacy Act</em> (Saskatchewan) (“LA FOIP”) where the division is a
          local authority, and other mandatory law. If a conflict exists
          between these Terms and mandatory law or binding board policy, the
          mandatory rule prevails.
        </p>
      </LegalSection>

      <LegalSection title="20. General provisions">
        <LegalList
          items={[
            "Entire agreement. These Terms and the other Policies constitute the entire agreement between you (and, where applicable, the school division) and the Owner regarding the service, and supersede prior informal descriptions of the product. No purchase order, RFP response, or vendor form amends them unless the Owner signs that amendment.",
            "Severability. If a provision is held unenforceable, it will be modified to the minimum extent necessary to make it enforceable, and the remaining provisions will continue in effect. The Owner’s intent is the maximum lawful protection of Cubicle.",
            "Waiver. Failure to enforce a provision is not a waiver. Waiver requires a written instrument signed by the Owner that identifies the specific right waived.",
            "Assignment. You may not assign these Terms. The Owner may assign them in connection with operating or transferring the service.",
            "No third-party beneficiaries. These Terms do not create rights in students, parents, unions, or other third parties except as mandatory law requires. The Owner may enforce the IP Policy against anyone bound by it.",
            "Relationship. These Terms do not create a partnership, joint venture, employment, or fiduciary relationship with the Owner. Providing Cubicle is not an admission that the Owner is a school official for all purposes, except as privacy law may require for processing school records.",
            "Force majeure. The Owner is not liable for delay or failure caused by events beyond reasonable control, including outages of Google, hosting, or email providers, labour disputes, network failure, or emergency school closures.",
            "Export and misuse of screenshots. You may not export, photograph, or record the service for the purpose of rebuilding it.",
            "Headings. Headings are for convenience only and do not affect interpretation.",
            "Language. These Terms are prepared in English. If a translation is provided, the English version controls to the extent permitted by law.",
            "Electronic acceptance. Checking a consent box, signing in, or continuing to use the service after notice of the Terms is an electronic signature and acceptance under applicable electronic-commerce law.",
          ]}
        />
      </LegalSection>

      <LegalSection title="21. Assumption of risk, releases, and claims">
        <p>
          You understand that cart scheduling, device use, and classroom
          supervision involve operational risk that the software cannot
          eliminate. You assume the risk of relying on the board, of
          equipment that is booked but physically unavailable or unsafe, and
          of service interruptions. You release {LEGAL_OWNER} from claims
          that the service should have prevented a classroom, employment, or
          equipment incident, to the fullest extent permitted by law.
        </p>
        <p>
          To the extent permitted, you will not sue the Owner for:
        </p>
        <LegalList
          items={[
            "Ordinary negligence in providing a free or internally licensed school tool, except where the law forbids that release.",
            "Decisions made by administrators (allowlist, cancellations, maintenance, role changes).",
            "Content another staff member entered.",
            "Acts of third-party providers.",
            "Your own failure to keep an alternative lesson plan.",
          ]}
        />
        <p>
          If you or the division intend to bring a claim against the Owner,
          you must send written notice to{" "}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>{" "}
          describing the claim in reasonable detail at least thirty (30) days
          before filing, and must bring any permitted claim within one (1)
          year after you first knew or reasonably should have known of it,
          and in any event within two (2) years after the event, unless a
          longer period is mandatory and cannot be shortened. This does not
          limit the Owner’s time to sue for infringement or breach of the IP
          Policy.
        </p>
      </LegalSection>

      <LegalSection title="22. Injunctive relief and equitable remedies">
        <p>
          Breach of the licence, confidentiality, or IP Policy would cause
          irreparable harm. The Owner may seek an injunction, specific
          performance, delivery-up or destruction of infringing copies, and
          other equitable relief without limiting damages. To the extent a
          court will allow, the Owner need not post a bond.
        </p>
      </LegalSection>

      <LegalSection title="23. Contact">
        <p>
          Questions about these Terms and Conditions, requests for a copy, or
          notices relating to the service should be directed to school
          division IT:
        </p>
        <p>
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>
        </p>
        <p>
          Intellectual-property notices and permission requests: same address,
          subject “Cubicle Owner — IP”.
        </p>
        <p>
          Product documents:{" "}
          <a href="/legal">Legal overview</a>,{" "}
          <a href="/legal/intellectual-property">
            Intellectual Property &amp; Licence
          </a>
          , <a href="/legal/privacy">Privacy Policy</a>,{" "}
          <a href="/legal/acceptable-use">Acceptable Use Policy</a>,{" "}
          <a href="/legal/security">Security &amp; Data Safety</a>.
        </p>
      </LegalSection>
    </LegalShell>
  );
}

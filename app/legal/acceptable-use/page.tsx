import type { Metadata } from "next";
import {
  LegalList,
  LegalSection,
  LegalShell,
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
  title: "Acceptable Use Policy",
  description: `Detailed rules for appropriate, professional, and lawful use of ${LEGAL_PRODUCT} by school staff.`,
  path: "/legal/acceptable-use",
});

const TOC = [
  { href: "#1-purpose-and-application", label: "1. Purpose and application" },
  { href: "#2-who-this-applies-to", label: "2. Who this applies to" },
  { href: "#3-permitted-use", label: "3. Permitted use" },
  { href: "#4-booking-and-scheduling-ethics", label: "4. Booking and scheduling ethics" },
  { href: "#5-sharing-swaps-and-collaboration", label: "5. Sharing, swaps, and collaboration" },
  { href: "#6-issues-inventory-and-labels", label: "6. Issues, inventory, and labels" },
  { href: "#7-content-and-language-standards", label: "7. Content and language standards" },
  { href: "#8-accounts-credentials-and-sessions", label: "8. Accounts, credentials, and sessions" },
  { href: "#9-prohibited-technical-activity", label: "9. Prohibited technical activity" },
  { href: "#10-privacy-confidentiality-and-student-data", label: "10. Privacy, confidentiality, and student data" },
  { href: "#11-devices-cameras-and-qr-scanning", label: "11. Devices, cameras, and QR scanning" },
  { href: "#12-email-and-communications", label: "12. Email and communications" },
  { href: "#13-monitoring", label: "13. Monitoring" },
  { href: "#14-enforcement", label: "14. Enforcement" },
  { href: "#15-reporting", label: "15. Reporting" },
  { href: "#16-relationship-to-other-policies", label: "16. Relationship to other policies" },
] as const;

export default function AcceptableUsePage() {
  return (
    <LegalShell
      title="Acceptable Use Policy"
      description={`Rules for using ${LEGAL_PRODUCT} in a professional, fair, secure, and school-appropriate manner. This policy is binding on every authorized user.`}
      effectiveDate={LEGAL_EFFECTIVE_DATE}
    >
      <LegalToc items={TOC} />

      <LegalSection title="1. Purpose and application">
        <p>
          {LEGAL_PRODUCT} exists so staff can share laptop carts and related
          technology fairly, see who has which resource, report problems, and
          let IT keep inventory accurate. This Acceptable Use Policy (AUP)
          defines permitted and prohibited conduct.
        </p>
        <p>
          It applies whenever you access the service — on a school computer, a
          personal phone, a substitute’s laptop, or any other device. It
          applies in addition to the division’s general technology AUP, codes
          of conduct, and employment obligations.
        </p>
      </LegalSection>

      <LegalSection title="2. Who this applies to">
        <LegalList
          items={[
            "Teachers, including substitute and temporary instructional staff with allowlisted access.",
            "Administrators and IT personnel with elevated tools.",
            "Anyone using a session opened in their name, including if they leave a browser signed in.",
            "Vendors or contractors only if the division has expressly allowlisted them for a defined task.",
          ]}
        />
        <p>
          Students, parents, and the public must not be given credentials or
          be asked to operate {LEGAL_PRODUCT} as if they were staff.
        </p>
      </LegalSection>

      <LegalSection title="3. Permitted use">
        <p>Authorized staff may use {LEGAL_PRODUCT} to:</p>
        <LegalList
          items={[
            "View cart availability against the bell schedule and book carts for instructional or approved school activity.",
            "Cancel or release their own bookings when plans change.",
            "Invite a colleague to share a slot, or accept/decline a share, in good faith.",
            "Request a swap or handoff when operationally necessary, with an honest reason.",
            "Report equipment problems accurately and with an appropriate severity.",
            "Update their own professional profile and notification preferences.",
            "Scan official cart or laptop QR labels to identify inventory (where that feature is enabled).",
            "Administrators: maintain cart status, restrictions, laptop codes, staff allowlist, booking policy, and reports.",
          ]}
        />
        <p>
          If you are unsure whether an action is permitted, ask IT before
          doing it. Convenience is not permission to bypass controls.
        </p>
      </LegalSection>

      <LegalSection title="4. Booking and scheduling ethics">
        <p>
          Shared carts are a scarce school resource. Software booking is a
          coordination tool, not a claim of personal ownership.
        </p>
        <LegalList
          items={[
            "Book only the periods you reasonably need. Do not hoard carts “just in case” across many days if that blocks colleagues.",
            "Enter truthful class, purpose, or tag information so others and IT can understand the reservation.",
            "Do not create fake classes, placeholder names, or junk bookings to hold a cart.",
            "Cancel promptly when a lesson is moved, a field trip is cancelled, or you no longer need the equipment.",
            "Respect booking windows, daily slot limits, and locked periods (for example AP exams or inventory days).",
            "Do not pressure or harass colleagues through the board, share invites, or swap requests.",
            "Do not use admin tools (if you have them) to favour yourself unfairly or to punish another staff member.",
            "Physical collection of a cart still follows school checkout practice. A green slot in software does not excuse leaving a cart in an unsecured hallway.",
          ]}
        />
      </LegalSection>

      <LegalSection title="5. Sharing, swaps, and collaboration">
        <LegalList
          items={[
            "Share a slot only with a colleague who will actually use the cart with you or instead of you as agreed.",
            "Do not use share invites to evade slot limits or to park a cart with someone who is not teaching that period.",
            "Respond to pending invites and swap requests in a timely way during work days.",
            "Decline rather than ignore a request you cannot honour, so the other person can plan.",
            "Handoff and exchange tools are for operational need, not for trading favours that break department rules.",
            "If you accept a share, you share responsibility for returning equipment in usable condition.",
          ]}
        />
      </LegalSection>

      <LegalSection title="6. Issues, inventory, and labels">
        <LegalList
          items={[
            "Report broken, missing, or unsafe equipment promptly. Do not leave a known hazard for the next class.",
            "Choose severity honestly. High severity may automatically pull a cart from circulation — use it for real risk, not to win a booking dispute.",
            "Do not file retaliatory, joking, or defamatory issue reports about colleagues.",
            "Laptop codes and QR labels are inventory controls. Do not publish them on public social media or in unsecured documents.",
            "Do not peel, swap, or counterfeit labels to conceal missing devices.",
            "Administrators pausing a cart for maintenance should resolve or reassign affected bookings rather than leaving classrooms surprised.",
          ]}
        />
      </LegalSection>

      <LegalSection title="7. Content and language standards">
        <p>
          Everything you type into {LEGAL_PRODUCT} (notes, issue descriptions,
          swap reasons, profile bio, class tags) is school operational
          content. It may be visible to other authorized staff and to
          administrators.
        </p>
        <LegalList
          items={[
            "Keep language professional and suitable for a workplace record.",
            "Do not include hate speech, harassment, threats, sexually explicit material, or discriminatory remarks.",
            "Do not include passwords, private addresses unrelated to work, or gossip about students or families.",
            "Do not upload or paste malware, tracking scripts, or content intended to disrupt the service.",
            "Profile photos must be appropriate workplace images (typically your Google Workspace photo).",
          ]}
        />
      </LegalSection>

      <LegalSection title="8. Accounts, credentials, and sessions">
        <LegalList
          items={[
            `Sign in only with your own allowlisted @${LEGAL_SCHOOL_DOMAIN} Google account.`,
            "Never use Gmail, personal Google accounts, or another staff member’s login.",
            "Do not share passwords, magic links, screenshots of live sessions, or browser profiles that stay signed in.",
            "Lock or sign out of devices in classrooms, prep rooms, and supply carts.",
            "Do not keep a personal copy of the staff directory or laptop-code list on unapproved cloud drives.",
            "If you are covering a class, ask IT or an admin for proper access rather than borrowing a colleague’s signed-in screen, unless local procedure expressly allows supervised use of a already-open board for that period only — you still must not change the other person’s account settings.",
          ]}
        />
      </LegalSection>

      <LegalSection title="9. Prohibited technical activity">
        <p>The following are strictly prohibited:</p>
        <LegalList
          items={[
            "Attempting to access the platform without allowlist approval.",
            "Bypassing, probing, scanning, or disabling security or access controls.",
            "Using automated scripts, scrapers, or bots against the service except tools IT has approved.",
            "Interfering with availability, integrity, or performance (denial of service, flooding bookings, corrupting records).",
            "Testing exploits, injecting payloads, or performing “security research” on the production school system without written IT authorization.",
            "Impersonating another user, a cart, or an administrator.",
            "Accessing or attempting to access another user’s account, tokens, or email.",
            "Exfiltrating bulk school records for use outside assigned duties.",
            `Introducing malware, ransomware, or unauthorized remote-access software via any ${LEGAL_PRODUCT} field or related workflow.`,
          ]}
        />
        <p>
          Unauthorized access to a computer system may be a criminal offence.
          Good-faith vulnerability reports must follow the Security &amp; Data
          Safety statement and must not disrupt school operations.
        </p>
      </LegalSection>

      <LegalSection title="10. Privacy, confidentiality, and student data">
        <LegalList
          items={[
            "Treat staff names, booking patterns, phone numbers, and issue notes as confidential workplace information.",
            "Do not discuss another teacher’s schedule publicly in a way that is harassing or unrelated to operations.",
            "Do not enter student personal information, student numbers, medical details, or safeguarding notes into Cubicle unless a documented procedure requires that exact information for the task.",
            "Do not use the platform to record disciplinary information about students or staff that belongs in official HR or student-record systems.",
            "Follow LA FOIP and division privacy rules when exporting reports or taking screenshots of the board.",
          ]}
        />
      </LegalSection>

      <LegalSection title="11. Devices, cameras, and QR scanning">
        <p>
          Phone and tablet use is allowed for authorized staff. You must still
          follow school rules about phones around students.
        </p>
        <LegalList
          items={[
            "Camera permission is only for scanning official Cubicle QR labels when you initiate a scan.",
            "Do not point the scanner at students, ID badges, or unrelated codes as a joke or as surveillance.",
            "Do not store captured frames of classrooms on personal devices beyond what the OS briefly uses to decode a code.",
            `School-owned devices used for ${LEGAL_PRODUCT} remain subject to division device policy, including loss, encryption, and inspection rules.`,
          ]}
        />
      </LegalSection>

      <LegalSection title="12. Email and communications">
        <LegalList
          items={[
            "Do not use notification features to spam colleagues or to send non-school content.",
            "Test-email from Settings is only to verify that your school address can receive operational mail.",
            "Do not spoof, misstate, or hide the school identity associated with your account.",
            `If you receive a message that looks like ${LEGAL_PRODUCT} but asks for your Google password, treat it as phishing and report it to IT — ${LEGAL_PRODUCT} will not ask you to paste your password into email.`,
          ]}
        />
      </LegalSection>

      <LegalSection title="13. Monitoring">
        <p>
          {LEGAL_PRODUCT} is a workplace system. Administrators and operators
          may access logs, bookings, issue reports, and account records as
          needed to run the school service, investigate misuse, secure the
          platform, and meet legal duties. You should have no expectation of
          personal privacy in Content you submit to the service, beyond the
          protections in the Privacy Policy and applicable law.
        </p>
        <p>
          Presence indicators and realtime updates are operational features,
          not covert surveillance of off-duty life. They must not be used to
          harass staff.
        </p>
      </LegalSection>

      <LegalSection title="14. Enforcement">
        <p>
          Violations may result in one or more of the following, depending on
          severity and division policy:
        </p>
        <LegalList
          items={[
            "Informal warning or direction to correct records.",
            `Temporary suspension of ${LEGAL_PRODUCT} access.`,
            "Permanent removal from the allowlist.",
            "Referral to school administration, human resources, or professional-conduct processes.",
            "Referral to law enforcement where conduct may be criminal (unauthorized access, harassment, theft of equipment, etc.).",
            "Restoration costs or other employment consequences as policy allows.",
          ]}
        />
        <p>
          IT may suspend first and investigate second when there is a
          security or safety risk. Enforcement decisions about employment
          remain with the school division, not with the software itself.
        </p>
      </LegalSection>

      <LegalSection title="15. Reporting">
        <p>You must promptly report:</p>
        <LegalList
          items={[
            "Lost or stolen devices that were signed in to Cubicle.",
            "Suspected account takeover or phishing.",
            "Bookings or issue reports that appear malicious or harassing.",
            "Missing carts or labels that suggest theft or tampering.",
            "Any accidental entry of sensitive student or medical information so it can be removed.",
          ]}
        />
        <p>
          Report misuse or security concerns to{" "}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
          If someone is in immediate danger, contact emergency services first.
        </p>
      </LegalSection>

      <LegalSection title="16. Relationship to other policies">
        <p>
          This AUP is part of the{" "}
          <a href="/legal/terms">Terms &amp; Conditions</a>. Privacy handling
          is described in the <a href="/legal/privacy">Privacy Policy</a>.
          Technical safeguards and incident reporting are in{" "}
          <a href="/legal/security">Security &amp; Data Safety</a>.
        </p>
        <p>
          Division board policy, collective agreements, and professional
          codes continue to apply. Where this AUP is more specific to{" "}
          {LEGAL_PRODUCT}, follow this AUP as well. Where mandatory law or
          board policy is stricter, the stricter rule prevails.
        </p>
      </LegalSection>
    </LegalShell>
  );
}

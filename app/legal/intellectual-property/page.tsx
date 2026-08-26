import type { Metadata } from "next";
import {
  LegalList,
  LegalSection,
  LegalShell,
  LegalToc,
} from "@/components/legal/legal-shell";
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_DOMAIN,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_OWNER,
  LEGAL_PRODUCT,
} from "@/lib/legal/constants";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "Intellectual Property & Licence",
  description: `${LEGAL_PRODUCT} is licensed, not sold. Copying, remaking, selling, or building a similar product — including with a different UI — is forbidden without the Cubicle Owner’s explicit written permission.`,
  path: "/legal/intellectual-property",
});

const TOC = [
  { href: "#1-binding-effect", label: "1. Binding effect" },
  { href: "#2-who-owns-cubicle", label: "2. Who owns Cubicle" },
  { href: "#3-licence-to-use-not-a-sale", label: "3. Licence to use, not a sale" },
  { href: "#4-the-school-division-is-a-licensee", label: "4. The school division is a licensee" },
  { href: "#5-absolute-prohibitions", label: "5. Absolute prohibitions" },
  { href: "#6-no-different-ui-workaround", label: "6. No “different UI” workaround" },
  { href: "#7-no-inspiration-specification-or-vendor-rebuild", label: "7. No inspiration, specification, or vendor rebuild" },
  { href: "#8-trade-secrets-and-confidentiality", label: "8. Trade secrets and confidentiality" },
  { href: "#9-source-code-design-and-the-private-repository", label: "9. Source code, design, and the private repository" },
  { href: "#10-reverse-engineering-scraping-and-ai", label: "10. Reverse engineering, scraping, and AI" },
  { href: "#11-trademarks-wordmark-and-publicity", label: "11. Trademarks, wordmark, and publicity" },
  { href: "#12-feedback-and-moral-rights", label: "12. Feedback and moral rights" },
  { href: "#13-school-records-versus-the-software", label: "13. School records versus the software" },
  { href: "#14-who-is-bound", label: "14. Who is bound" },
  { href: "#15-written-permission-only", label: "15. Written permission only" },
  { href: "#16-survival", label: "16. Survival" },
  { href: "#17-remedies", label: "17. Remedies" },
  { href: "#18-no-waiver-of-rights-by-providing-the-service", label: "18. No waiver of rights by providing the service" },
  { href: "#19-contact-and-notices", label: "19. Contact and notices" },
] as const;

export default function IntellectualPropertyPage() {
  return (
    <LegalShell
      title="Intellectual Property & Licence"
      description={`${LEGAL_PRODUCT} is owned by ${LEGAL_OWNER}. Access is a limited licence to operate the live service for authorized school use. It is not a sale, not a transfer of ownership, and not permission to copy, remake, sell, or build anything similar.`}
      effectiveDate={LEGAL_EFFECTIVE_DATE}
    >
      <LegalToc items={TOC} />

      <LegalSection title="1. Binding effect">
        <p>
          This Intellectual Property &amp; Licence policy (this “IP Policy”)
          is part of the {LEGAL_PRODUCT}{" "}
          <a href="/legal/terms">Terms &amp; Conditions</a>. It binds every
          person and organization that accesses, views, evaluates, administers,
          hosts, screenshots, discusses internally, or otherwise uses{" "}
          {LEGAL_PRODUCT}, including the participating school division, its
          trustees, officers, employees, substitutes, contractors, consultants,
          volunteers, IT staff, vendors, and anyone they allow to see the
          service.
        </p>
        <p>
          By signing in, clicking to accept, using the service, or continuing
          to use it after this policy is posted, you agree. If you do not
          agree, do not access {LEGAL_PRODUCT} and do not use knowledge of it
          to build anything else.
        </p>
        <p>
          If any part of this IP Policy is held too broad to enforce, it will
          be narrowed only to the minimum extent required, and the rest remains
          in force. The Owner’s intent is the strongest protection of{" "}
          {LEGAL_PRODUCT} that applicable law allows.
        </p>
      </LegalSection>

      <LegalSection title="2. Who owns Cubicle">
        <p>
          All right, title, and interest in and to {LEGAL_PRODUCT} is and
          remains exclusively with {LEGAL_OWNER} (the “Owner”). That includes,
          without limitation:
        </p>
        <LegalList
          items={[
            "Source code, object code, scripts, database schemas, migrations, configuration, and build tooling.",
            "Visual design, layout, typography, colour, motion, iconography, the Cubicle wordmark, and the distinctive schedule-board arrangement.",
            "User experience, information architecture, booking/share/swap/issue/QR workflows, and the way those pieces fit together.",
            "Documentation, legal pages, operator guides, label and QR designs, copy, and training explanations.",
            "Inventions, know-how, methods, algorithms, access-control model, sealed QR payload design, and other trade secrets.",
            "Updates, improvements, and future versions, whether suggested by users or not.",
          ]}
        />
        <p>
          No school division, staff member, contractor, student, parent, or
          third party acquires ownership of {LEGAL_PRODUCT} by using it,
          paying for hosting, suggesting a feature, appearing in a screenshot,
          or administering allowlists. Use is not authorship. Hosting school
          data in the service is not a transfer of the software.
        </p>
        <p>
          Nothing in any informal conversation, ticket, email, or classroom
          demo is an assignment of intellectual property unless it is a written
          instrument signed by the Owner that expressly assigns those rights.
        </p>
      </LegalSection>

      <LegalSection title="3. Licence to use, not a sale">
        <p>
          Subject to the Terms and this IP Policy, the Owner grants a limited,
          personal (or, for the division, institutional), non-exclusive,
          non-transferable, non-sublicensable, non-assignable, revocable
          licence to access the then-current hosted instance of{" "}
          {LEGAL_PRODUCT} solely to coordinate school laptop-cart operations
          for the participating division, and only while the user remains
          allowlisted.
        </p>
        <p>
          This is a licence to <em>use the live service</em>. It is not a sale
          of software, not a copy of the source, not an on-prem perpetual
          licence, not an escrow of code, and not permission to reproduce{" "}
          {LEGAL_PRODUCT} anywhere else.
        </p>
        <LegalList
          items={[
            "You may not copy, download (except ordinary browser caching), or retain the application except as technically required to display a page you are authorized to see.",
            "You may not sublicense, rent, lend, lease, timeshare, or commercially exploit the service.",
            "You may not move Cubicle to another school, company, or product without a separate written licence from the Owner.",
            "When access ends, the licence ends immediately. Knowledge you gained while using Cubicle remains subject to the prohibitions below.",
          ]}
        />
      </LegalSection>

      <LegalSection title="4. The school division is a licensee">
        <p>
          The participating school division is a licensee, not a co-owner, not
          a joint author, and not a commissioner of a work made in the course
          of employment for the Owner unless a separate written agreement
          signed by the Owner says otherwise.
        </p>
        <p>
          Providing {LEGAL_PRODUCT} to the division, connecting it to school
          Google accounts, storing school operational records, or listing the
          service in an internal catalogue does <strong>not</strong>:
        </p>
        <LegalList
          items={[
            "Assign copyright, trademark, industrial design, or trade-secret rights to the division or to the Crown.",
            "Create a work made for hire, a commissioned work, or an implied licence to reproduce Cubicle.",
            "Authorize the division to obtain a competing or replacement system by showing Cubicle to a vendor, student intern, or staff developer.",
            "Authorize the division to sell, gift, open-source, or “hand over” Cubicle to another school, consortium, or ministry.",
            "Give the division a right to source code, design files, or a local copy of the repository.",
          ]}
        />
        <p>
          School operational records (bookings, issues, inventory, allowlist)
          remain school records as described in the Privacy Policy. The
          software that processes those records remains the Owner’s.
        </p>
      </LegalSection>

      <LegalSection title="5. Absolute prohibitions">
        <p>
          Except to the limited extent a mandatory statute cannot be waived,
          and except with the Owner’s prior explicit written permission, no
          person or organization may do any of the following with{" "}
          {LEGAL_PRODUCT} or with knowledge obtained from it:
        </p>
        <LegalList
          items={[
            "Copy, reproduce, republish, or distribute the software, interface, documentation, or distinctive visual design.",
            "Sell, licence, lease, gift, or otherwise transfer Cubicle or a copy or adaptation of it.",
            "Remake, rewrite, reimplement, port, or rebuild Cubicle, in whole or in part.",
            "Create a derivative work, fork, clone, “inspired by” version, or unofficial companion app.",
            "Create a competing, substitute, or overlapping product for booking, sharing, swapping, or labelling school technology carts or similar equipment.",
            "Commission, hire, or pay anyone else to do any of the above.",
            "Use Cubicle as the specification, prototype, or reference for a request for proposals, intern project, capstone, hackathon, or vendor bid.",
            "Open-source, publish, or leak any part of Cubicle, including screenshots used as a build guide.",
            "Remove, hide, or alter proprietary notices, legal pages, or the Cubicle wordmark.",
          ]}
        />
        <p>
          These prohibitions apply whether the result is free or paid, internal
          or public, web or native, open-source or closed, “just for our
          school” or for resale.
        </p>
      </LegalSection>

      <LegalSection title="6. No “different UI” workaround">
        <p>
          Changing the look does not make a copy lawful. You may not create a
          product that is similar to {LEGAL_PRODUCT} by dressing it in a
          different colour, typeface, layout, component library, or brand
          name, or by adding, removing, or rearranging features.
        </p>
        <p>Without the Owner’s explicit written permission, you may not:</p>
        <LegalList
          items={[
            "Reproduce Cubicle’s structure, sequence, and organization (for example a period board, cart inventory, share/swap/issue flows, QR labels, and staff allowlist) under another name.",
            "Translate Cubicle into another framework, language, or platform (including “we rewrote it in X”).",
            "Ship a “simplified”, “mobile-only”, “admin-only”, or “white-label” variant.",
            "Claim independent creation where the new work was built by people who used, administered, or were briefed on Cubicle.",
            "Use a different UI, different feature set, or different branding as a defence if the work is derived from, modelled on, or intended as a replacement for Cubicle.",
          ]}
        />
        <p>
          Generic facts (that schools share laptop carts) are not monopolized.
          What is protected — and what you are forbidden to take — is{" "}
          {LEGAL_PRODUCT} itself: its expression, its combination of
          workflows, its look and feel, its documentation, and any substitute
          built from exposure to it.
        </p>
      </LegalSection>

      <LegalSection title="7. No inspiration, specification, or vendor rebuild">
        <p>
          You may not “take inspiration” from {LEGAL_PRODUCT} to produce
          another scheduling, inventory, or staff-operations product. You may
          not use memory, notes, recordings, screenshots, screen shares, or
          verbal walkthroughs of {LEGAL_PRODUCT} as the brief for a designer,
          developer, student, or vendor.
        </p>
        <LegalList
          items={[
            "Do not send Cubicle screenshots or recordings to an outside developer “so they know what we need”.",
            "Do not write an RFP or statement of work that is Cubicle restated in other words.",
            "Do not ask staff to list Cubicle’s screens or rules so another app can match them.",
            "Do not use Cubicle as a teaching example for how to build a competing internal tool.",
            "Do not train or fine-tune a model on Cubicle’s UI, copy, schema, or source in order to generate a similar product.",
          ]}
        />
        <p>
          If the division later wants a different system, it must specify its
          operational needs independently, without using {LEGAL_PRODUCT} as
          the template, and must not copy Cubicle’s expression. When in doubt,
          obtain the Owner’s written permission first.
        </p>
      </LegalSection>

      <LegalSection title="8. Trade secrets and confidentiality">
        <p>
          Non-public aspects of {LEGAL_PRODUCT} are the Owner’s confidential
          information and trade secrets, including architecture, access
          control, QR seal design, unpublished features, security
          configuration, and operator documentation.
        </p>
        <LegalList
          items={[
            "You will not disclose that information except to other authorized staff who need it for legitimate school use of the live service.",
            "You will not publish it, post it in public issue trackers, or give it to vendors.",
            "Confidentiality continues after you leave the school or stop using Cubicle.",
            "School operational records remain confidential school information as well; this section does not make those records the Owner’s property.",
          ]}
        />
      </LegalSection>

      <LegalSection title="9. Source code, design, and the private repository">
        <p>
          {LEGAL_PRODUCT} source and design materials, where they exist, are
          private. Access to a repository, hosting account, or design file —
          if ever granted — is a limited, revocable privilege and not a gift
          of ownership.
        </p>
        <LegalList
          items={[
            "Do not clone, fork, mirror, or download the repository except as the Owner expressly allows in writing.",
            "Do not add collaborators, make the repository public, or copy it to another host.",
            "Do not extract assets, fonts, or components for other products.",
            "Any copy you hold after access is revoked must be destroyed.",
          ]}
        />
      </LegalSection>

      <LegalSection title="10. Reverse engineering, scraping, and AI">
        <p>Without the Owner’s explicit written permission, you may not:</p>
        <LegalList
          items={[
            "Decompile, disassemble, reverse engineer, or attempt to derive source or schemas from the client, network traffic, or QR payloads, except only as a mandatory statute for interoperability cannot be waived — and even then, only after written notice to the Owner and only for lawful interoperability with Cubicle itself, never to build a substitute.",
            "Scrape, crawl, or bulk-export the interface or data except through features IT has approved for school reporting.",
            "Probe, fuzz, or attack the service as “research” on production systems without written authorization.",
            "Feed Cubicle’s UI, copy, or code into a generative model to produce a similar application, theme, or workflow.",
          ]}
        />
      </LegalSection>

      <LegalSection title="11. Trademarks, wordmark, and publicity">
        <p>
          “Cubicle”, the Cubicle wordmark, and related logos and product names
          are trademarks and official marks of the Owner, whether registered or
          unregistered. You may refer to {LEGAL_PRODUCT} factually as the
          school’s internal cart-scheduling tool. You may not:
        </p>
        <LegalList
          items={[
            "Use Cubicle marks on another product, bid, or website in a way that suggests sponsorship or that the other product is Cubicle.",
            "Register domain names, social handles, or app-store listings that impersonate Cubicle.",
            "Issue a press release claiming the division owns or built Cubicle.",
          ]}
        />
      </LegalSection>

      <LegalSection title="12. Feedback and moral rights">
        <p>
          If you suggest an idea, design, name, or improvement, you assign to
          the Owner all intellectual-property rights in that feedback, to the
          extent you have any, and you waive moral rights in it to the extent
          permitted by the Copyright Act (Canada) and other applicable law.
          The Owner may use feedback without credit, payment, or obligation.
        </p>
        <p>
          Suggesting a feature does not make you a co-author and does not
          entitle you to a licence beyond ordinary use of the live service.
        </p>
      </LegalSection>

      <LegalSection title="13. School records versus the software">
        <p>
          Bookings, issues, inventory, and staff directory fields are school
          operational records. The Owner processes them to run the service and
          does not claim to own the division’s underlying facts (who booked
          which cart). The Owner does claim ownership of the software, schema
          design, and presentation used to store and show those facts.
        </p>
        <p>
          Exporting school records through approved admin tools for school
          purposes is allowed. Exporting them in order to populate a clone of{" "}
          {LEGAL_PRODUCT} is not.
        </p>
      </LegalSection>

      <LegalSection title="14. Who is bound">
        <p>This IP Policy binds, without limitation:</p>
        <LegalList
          items={[
            "Every signed-in user, including teachers, substitutes, temporary staff, and administrators.",
            "The participating school division as an institution, and its board, officers, and agents.",
            "Contractors, consultants, managed-service providers, and student interns who see Cubicle in the course of work for the division.",
            "Anyone who obtains Cubicle materials from a person who was bound.",
          ]}
        />
        <p>
          The division will not authorize, fund, or look the other way on a
          project that would breach this IP Policy. Staff who commission a
          clone still breach this policy personally as well as on behalf of
          the institution.
        </p>
      </LegalSection>

      <LegalSection title="15. Written permission only">
        <p>
          The only exception to the prohibitions in this IP Policy is{" "}
          <strong>prior explicit written permission</strong> from the Owner.
          Verbal approval, a Slack or Teams message, a ticket comment, silence,
          or continued provision of the service is not permission.
        </p>
        <p>
          Written permission, if granted, will state the exact scope (who,
          what, how long, for which school). Anything not stated is withheld.
          Permission may be refused for any reason or no reason, and may be
          revoked.
        </p>
        <p>
          Requests:{" "}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>{" "}
          with the subject line “Cubicle Owner — written IP permission”.
        </p>
      </LegalSection>

      <LegalSection title="16. Survival">
        <p>
          Sections concerning ownership, prohibitions, confidentiality, trade
          secrets, moral rights, trademarks, remedies, and this survival
          clause continue after you stop using {LEGAL_PRODUCT}, after you
          leave the school, and after the division stops using the service.
        </p>
      </LegalSection>

      <LegalSection title="17. Remedies">
        <p>
          A breach of this IP Policy would cause irreparable harm for which
          money may be inadequate. The Owner may seek immediate injunctive or
          other equitable relief in any court of competent jurisdiction,
          without the need to post a bond to the extent a court will allow,
          and without limiting any other remedy.
        </p>
        <p>
          The Owner may also recover damages, disgorgement of profits from a
          forbidden product, destruction or delivery-up of infringing copies,
          and reasonable legal fees to the extent permitted by law. These
          remedies are cumulative.
        </p>
        <p>
          Unauthorized copying or circumvention of technical measures may also
          violate the Copyright Act (Canada) and other criminal or civil law.
          The Owner may report unlawful access or theft of trade secrets to
          law enforcement.
        </p>
      </LegalSection>

      <LegalSection title="18. No waiver of rights by providing the service">
        <p>
          Allowing the division to use {LEGAL_PRODUCT}, fixing bugs, adding
          features, or remaining silent about a suspected copy is not a waiver
          of the Owner’s rights. Waiver requires a written instrument signed
          by the Owner that identifies the specific right waived.
        </p>
      </LegalSection>

      <LegalSection title="19. Contact and notices">
        <p>
          School operational questions:{" "}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
        </p>
        <p>
          Infringement, cloning, unauthorized repositories, or permission
          requests: the same address, subject “Cubicle Owner — IP”.
        </p>
        <p>
          Related documents:{" "}
          <a href="/legal/terms">Terms &amp; Conditions</a>,{" "}
          <a href="/legal/acceptable-use">Acceptable Use Policy</a>,{" "}
          <a href="/legal/privacy">Privacy Policy</a>,{" "}
          <a href="/legal/security">Security &amp; Data Safety</a>.
        </p>
        <p>
          This IP Policy is posted at {LEGAL_DOMAIN}. The effective date above
          is the current version.
        </p>
      </LegalSection>
    </LegalShell>
  );
}

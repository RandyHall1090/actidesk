import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | ActiDesk",
  description: "How ActiForge collects, uses, shares, and protects information on the ActiDesk website.",
  alternates: { canonical: "/privacy" },
};

// Approved policy text (Securafy's, reviewed by Monjur), with the company
// name changed to ActiForge. Edit wording only with the same approval.
const H2 = "mt-10 font-display text-xl font-bold text-bone";
const P = "mt-4 text-base leading-7 text-bone-dim";
const UL = "mt-4 list-disc space-y-2 pl-6 text-base leading-7 text-bone-dim";
const STRONG = "font-semibold text-bone";
const LINK = "text-electric underline hover:text-bone";

export default function PrivacyPolicyPage() {
  return (
    <article className="mx-auto w-full max-w-3xl px-6 py-16">
      <h1 className="font-display text-4xl font-bold text-bone">Privacy Policy</h1>
      <p className="mt-3 font-mono-brand text-xs uppercase tracking-wider text-bone-dim">
        Effective Date: May 7, 2026 &nbsp;·&nbsp; Last Updated: May 7, 2026
      </p>

      <p className={P}>
        ActiForge (&ldquo;ActiForge,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) is committed to
        protecting your privacy. This Privacy Policy describes how we collect, use, disclose, and safeguard
        information when you visit our website at{" "}
        <a href="https://www.actidesk.ai" className={LINK}>
          www.actidesk.ai
        </a>
        , use our services, or interact with us. Please read this policy carefully. If you disagree with its terms,
        please discontinue use of our site.
      </p>

      <h2 className={H2}>1. Information We Collect</h2>
      <p className={P}>
        <strong className={STRONG}>Information you provide directly:</strong> We collect information you voluntarily
        provide when you fill out forms, request assessments, subscribe to communications, or contact us. This may
        include your name, business name, email address, phone number, mailing address, and the nature of your inquiry.
      </p>
      <p className={P}>
        <strong className={STRONG}>Information collected automatically:</strong> When you visit our website, we
        automatically collect certain information about your device and browsing behavior, including IP address,
        browser type, operating system, referring URLs, pages visited, and time spent on pages. We use Google Tag
        Manager, Google Analytics 4, LinkedIn Insight Tag, and HubSpot tracking technologies for this purpose.
      </p>
      <p className={P}>
        <strong className={STRONG}>Information from third parties:</strong> We may receive information about you from
        third-party sources including HubSpot (our CRM), LinkedIn, and other business intelligence platforms.
      </p>

      <h2 className={H2}>2. How We Use Your Information</h2>
      <p className={P}>We use the information we collect to:</p>
      <ul className={UL}>
        <li>Respond to your inquiries and deliver the services you request</li>
        <li>Send you requested proposals, assessments, and educational content</li>
        <li>Send you our newsletter, ActiForge Times, if you have subscribed</li>
        <li>Improve our website, services, and marketing effectiveness</li>
        <li>Comply with legal obligations and protect our legal rights</li>
        <li>Detect, prevent, and address fraud or security incidents</li>
        <li>Personalize your experience on our website</li>
      </ul>

      <h2 className={H2}>3. Cookies and Tracking Technologies</h2>
      <p className={P}>
        We use cookies, web beacons, and similar tracking technologies to collect and store information about your
        interactions with our site. These include:
      </p>
      <ul className={UL}>
        <li>
          <strong className={STRONG}>Essential cookies:</strong> Required for the site to function properly
        </li>
        <li>
          <strong className={STRONG}>Analytics cookies:</strong> Google Analytics 4 — help us understand how visitors
          use our site
        </li>
        <li>
          <strong className={STRONG}>Marketing cookies:</strong> LinkedIn Insight Tag, HubSpot — enable us to deliver
          relevant advertising and measure campaign effectiveness
        </li>
        <li>
          <strong className={STRONG}>Functional cookies:</strong> HubSpot — power our chat widget, form submissions,
          and contact tracking
        </li>
      </ul>
      <p className={P}>
        You may control cookies through your browser settings. Disabling certain cookies may affect site functionality.
      </p>

      <h2 className={H2}>4. How We Share Your Information</h2>
      <p className={P}>We do not sell your personal information. We may share your information with:</p>
      <ul className={UL}>
        <li>
          <strong className={STRONG}>Service providers:</strong> HubSpot (CRM and marketing), Google (analytics),
          LinkedIn (advertising), and other vendors who assist us in operating our business — all under
          confidentiality obligations
        </li>
        <li>
          <strong className={STRONG}>Legal requirements:</strong> When required by law, court order, or governmental
          authority
        </li>
        <li>
          <strong className={STRONG}>Business transfers:</strong> In connection with a merger, acquisition, or sale of
          all or substantially all of our assets, subject to confidentiality protections
        </li>
        <li>
          <strong className={STRONG}>Protection of rights:</strong> When we believe disclosure is necessary to protect
          our rights, your safety, or the safety of others
        </li>
      </ul>

      <h2 className={H2}>5. Data Retention</h2>
      <p className={P}>
        We retain your personal information for as long as necessary to fulfill the purposes for which it was
        collected, provide our services, comply with legal obligations, resolve disputes, and enforce our agreements.
        Contact and inquiry data is retained in HubSpot for a minimum of three years unless you request deletion.
      </p>

      <h2 className={H2}>6. Your Rights and Choices</h2>
      <p className={P}>Depending on your location, you may have the right to:</p>
      <ul className={UL}>
        <li>Access the personal information we hold about you</li>
        <li>Request correction of inaccurate information</li>
        <li>Request deletion of your personal information</li>
        <li>Opt out of marketing communications at any time (use the unsubscribe link in any email)</li>
        <li>Request restriction of processing in certain circumstances</li>
      </ul>
      <p className={P}>
        To exercise any of these rights, contact us at{" "}
        <a href="mailto:sales@securafy.com" className={LINK}>
          sales@securafy.com
        </a>
        .
      </p>

      <h2 className={H2}>7. Ohio Residents — Ohio Safe Harbor Act</h2>
      <p className={P}>
        ActiForge maintains a written cybersecurity program aligned to the NIST Cybersecurity Framework 2.0 as required
        for Ohio Safe Harbor protection under Ohio Revised Code §1354. We implement reasonable security measures to
        protect personal information including encryption at rest and in transit, access controls, multi-factor
        authentication, and continuous monitoring.
      </p>

      <h2 className={H2}>8. Children&apos;s Privacy</h2>
      <p className={P}>
        Our website and services are not directed to individuals under the age of 18. We do not knowingly collect
        personal information from children. If you believe we have inadvertently collected such information, please
        contact us immediately at{" "}
        <a href="mailto:sales@securafy.com" className={LINK}>
          sales@securafy.com
        </a>
        .
      </p>

      <h2 className={H2}>9. Links to Third-Party Websites</h2>
      <p className={P}>
        Our website may contain links to third-party websites. We are not responsible for the privacy practices or
        content of those sites. We encourage you to review the privacy policies of any third-party sites you visit.
      </p>

      <h2 className={H2}>10. Security</h2>
      <p className={P}>
        We implement administrative, technical, and physical security measures to protect your personal information.
        As an MSSP, we hold ourselves to the same security standards we deliver to our clients — including encryption,
        access controls, and continuous monitoring. However, no method of transmission over the internet or electronic
        storage is 100% secure, and we cannot guarantee absolute security.
      </p>

      <h2 className={H2}>11. Changes to This Policy</h2>
      <p className={P}>
        We may update this Privacy Policy from time to time. We will notify you of material changes by updating the
        &ldquo;Last Updated&rdquo; date at the top of this page. Your continued use of our website after any changes
        constitutes acceptance of the updated policy.
      </p>

      <h2 className={H2}>12. Contact Us</h2>
      <p className={P}>
        <strong className={STRONG}>ActiForge</strong>
        <br />
        Privacy Officer
        <br />
        4449 Easton Way, Suite 200, Columbus, OH 43219
        <br />
        6100 Oak Tree Blvd, Suite 200, Independence, OH 44131
        <br />
        <a href="mailto:sales@securafy.com" className={LINK}>
          sales@securafy.com
        </a>
        <br />
        <a href="tel:+13309068888" className={LINK}>
          (330) 906-8888
        </a>
      </p>
    </article>
  );
}

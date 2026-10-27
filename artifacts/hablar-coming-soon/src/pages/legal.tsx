import { useEffect, type ReactNode } from 'react';
import { Link } from 'wouter';
import { ArrowLeft } from 'lucide-react';

type LegalSection = { id: string; title: string; body: ReactNode };

const privacySections: LegalSection[] = [
  {
    id: 'scope',
    title: '1. Who is responsible and what this notice covers',
    body: <>
      <p>This notice explains the HABLAR coming-soon website and its optional launch-update form. It does not describe a live listening service, accounts, or conversations. “HABLAR” refers to the project name, not a verified legal entity.</p>
      <p><strong>Owner/legal review required:</strong> the operator’s legal name, address, country of establishment, data-controller (GDPR) or Data Fiduciary (India) identity, and privacy/grievance contact have not been supplied. Any required representative or Data Protection Officer must also be confirmed. These are unresolved disclosures, not finalized business facts.</p>
    </>,
  },
  {
    id: 'data',
    title: '2. Information collected and how sign-up works',
    body: <>
      <p>You may provide an email address, a phone number, or both. At least one is required to sign up. The browser sends these details and your consent and terms-acceptance choices to HABLAR’s API. The API validates them, lowercases and trims email addresses, and checks phone numbers in international format. The calling-code selector helps format the number; it is not a request for your location.</p>
      <p>The PostgreSQL record contains encrypted contact fields, keyed lookup digests to detect duplicates, a record identifier, encryption-key version, creation and consent timestamps, and consent, privacy-notice and terms version labels. Only submissions with active consent and terms acceptance are accepted. Duplicate submissions may leave the earlier record unchanged; the same confirmation is shown for new and existing contacts to avoid revealing who signed up.</p>
      <p>The form does not ask for a name, password, date of birth, or health information. Please do not put personal stories or sensitive information in contact fields. A phone number may reveal a country calling code. Network requests also expose technical information such as an IP address and browser/request metadata to the infrastructure handling them; the API uses the remote address for rate limiting. These are not columns in the sign-up record. Infrastructure logging and its retention need owner confirmation.</p>
    </>,
  },
  {
    id: 'purpose',
    title: '3. Purpose, consent and your choice',
    body: <>
      <p>The stated purpose of collecting your contact details is to send one HABLAR launch update, not ongoing marketing. The current application saves sign-ups; it does not contain a launch-message delivery integration. The owner must confirm the sending provider and delivery channel before sending.</p>
      <p>You choose whether to sign up and which contact method to provide. You can browse without signing up. The consent checkbox is not preselected. Consent for the launch update is separate from accepting the Terms &amp; Conditions. Where GDPR applies, consent is the intended basis for this contact use; the owner must confirm the legal basis for any separate infrastructure/security processing. Where applicable and in force, the DPDP Act also requires valid consent for this stated purpose.</p>
      <p>You may withdraw consent at any time without affecting the lawfulness of processing before withdrawal. Withdrawal should stop future consent-based launch contact. It does not automatically make earlier processing unlawful. The current site has no withdrawal control or working privacy-request channel; see <a href="#requests">requests and grievances</a> before submitting. Not submitting avoids this collection; closing the page after submitting does not withdraw consent or delete a saved record.</p>
    </>,
  },
  {
    id: 'protection',
    title: '4. Stored contact-data protections',
    body: <>
      <p>The API encrypts email and phone fields with AES-GCM before writing them to PostgreSQL. It separately creates keyed HMAC-SHA256 lookup digests for duplicate detection. The database stores ciphertext rather than readable contact fields. Encryption and lookup keys are derived from a server-side secret, not stored as contact fields. Digests and encrypted records are still personal data, not anonymous data.</p>
      <p>The sign-up API returns a confirmation message, not stored contact details, and validation errors do not echo submitted values. Encryption reduces exposure but does not guarantee absolute security: someone with the necessary keys and access can decrypt contact data. The owner must verify operational access controls, backups, incident handling and any legally required breach notifications. This notice is not a security certification.</p>
    </>,
  },
  {
    id: 'providers',
    title: '5. Providers, disclosures and international transfers',
    body: <>
      <p>The project is configured to run on Replit, and the application uses a PostgreSQL database. The website requests DM Sans, Montserrat and Inter through Google Fonts, requesting styles from Google’s font service and font files from its delivery servers. Those requests disclose network information such as your IP address and browser/request metadata to Google; the font request is separate from sign-up and does not intentionally send your form fields. See <a href="https://developers.google.com/fonts/faq/privacy">Google Fonts’ privacy explanation</a>.</p>
      <p>No email/SMS delivery service or onward sale of contacts is implemented in the current sign-up code. This is not a complete inventory of infrastructure recipients. Hosting, database operations, network delivery and security services may handle data on the operator’s behalf; disclosures required by law may also be necessary.</p>
      <p><strong>Owner/legal review required:</strong> confirm the live hosting and database providers and contracting entities, subprocessors, authorized recipients, processing/storage countries, log and backup locations, and the launch-message provider. Where data crosses borders, confirm applicable GDPR transfer grounds and safeguards (such as an adequacy decision or appropriate contractual safeguards), how to obtain a copy, and any applicable Indian transfer restrictions. No specific storage country, transfer mechanism, processor agreement or localization guarantee is verified here.</p>
    </>,
  },
  {
    id: 'cookies',
    title: '6. Cookies, browser storage and analytics',
    body: <>
      <p>The current landing and legal pages do not implement advertising trackers, analytics events, or cookies/local storage for sign-up. Form state is held in the browser while the page is open; submitted records are stored by the server. This is a statement about these application pages, not a guarantee that hosting infrastructure or external font services never use cookies or logs.</p>
      <p><strong>Owner review required:</strong> verify live infrastructure cookies, access/security logs and any future analytics before making broader tracking claims or adding processing that needs notice or consent.</p>
    </>,
  },
  {
    id: 'retention',
    title: '7. Retention and deletion',
    body: <>
      <p>No automatic expiry or deletion schedule is implemented for sign-up records in the current application. Records can remain in the database until an operator removes them. Sending an update would not, by itself, trigger deletion in this code.</p>
      <p><strong>Owner/legal review required:</strong> set and publish a specific retention period or clear criteria for contacts, consent evidence, lookup digests, logs and backups. The schedule must address the launch update, withdrawal, an abandoned launch, any justified legal retention, and backup expiry. Do not assume contacts are deleted after the update. Applicable law may require erasure when consent is withdrawn or the purpose ends, subject to lawful exceptions; this still needs an operational process.</p>
    </>,
  },
  {
    id: 'rights',
    title: '8. Your applicable privacy rights',
    body: <>
      <p>Rights depend on the law that applies, its commencement dates, and any legal conditions or exceptions. This notice does not claim GDPR or DPDP certification or that every right applies to every visitor.</p>
      <ul>
        <li><strong>Under GDPR, where applicable:</strong> request access and a copy, correction, erasure, restriction of processing, and portability for qualifying data processed automatically on consent or contract. You may object where processing relies on legitimate interests or public tasks, and to direct marketing. You may withdraw consent and complain to a competent supervisory authority. The current sign-up code makes no automated decisions with legal or similarly significant effects and does not profile you.</li>
        <li><strong>Under India’s DPDP Act, where applicable and in force:</strong> withdraw consent; seek a summary of processing and information about sharing as provided by the Act; request correction, completion, updating and erasure; seek grievance redressal; and nominate another person to exercise rights in the event of death or incapacity. Relevant duties include giving authentic information and not making false or frivolous grievances.</li>
      </ul>
      <p>India’s DPDP framework has phased commencement. The owner must verify which provisions and rules are in force for HABLAR’s activities at the relevant time rather than treat all provisions as already applicable. Rights are not waived by accepting the Terms.</p>
    </>,
  },
  {
    id: 'requests',
    title: '9. Requests, withdrawal and grievances',
    body: <>
      <p><strong>Contact not yet provided:</strong> HABLAR’s owner has not supplied a verified privacy email, postal address, grievance officer/contact or monitored request form. There is currently no working on-site access, correction, export, erasure, nomination or withdrawal request route. The launch form only saves sign-ups; it does not process privacy requests. Do not send a request, identity document or complaint through its contact fields.</p>
      <p>The owner must publish and test a monitored route before public collection and provide an equally easy way to withdraw consent. Until then, if you have not signed up, consider waiting. If you already signed up, this notice cannot promise that a request can currently be delivered to HABLAR. Keep a note of when you submitted and the request you want to make; do not post your contact details publicly.</p>
      <p>Once a verified route is published, identify the contact method used to sign up and state the action you want (for example, “withdraw launch consent and erase my contact”). Share only information reasonably needed to locate and verify your record, not passwords or unnecessary identity documents. The owner must define proportionate verification, acknowledgments, response handling, any lawful refusal and escalation. GDPR normally requires a response within one month, with a permitted extension in qualifying cases and notice of that extension. Any Indian timelines must follow the provisions and rules then in force; no faster operational response is promised here.</p>
      <p>Where GDPR applies, you can complain to a supervisory authority, including in the country of your habitual residence, workplace, or alleged infringement. The <a href="https://www.edpb.europa.eu/about-edpb/about-edpb/members_en">EDPB directory of data protection authorities</a> and <a href="https://www.edpb.europa.eu/contact/file-a-complaint_en">EDPB complaint guidance</a> explain the route.</p>
      <p>Where the relevant DPDP provisions are in force, use the Data Fiduciary’s grievance mechanism first and, after exhausting that opportunity, seek redress with the Data Protection Board of India as permitted by law. Consult <a href="https://www.meity.gov.in/">MeitY’s official DPDP information</a> for current commencement and Board guidance. That government website is not HABLAR’s contact channel. The missing HABLAR grievance route must be resolved by the owner; it is not a reason to give up any applicable right.</p>
    </>,
  },
  {
    id: 'review',
    title: '10. Notice updates and outstanding owner decisions',
    body: <>
      <p>This notice describes the current pre-launch implementation. A listening service or new data use would need its own accurate disclosures before it starts. Changes to this page do not by themselves grant consent to a new purpose.</p>
      <p><strong>Before public collection, the owner and legal adviser must resolve:</strong> operator identity and jurisdiction; privacy and grievance routes; legal bases and applicable commencement dates; provider/recipient and transfer details; retention and rights handling; and any required child/guardian-consent safeguards. The form does not collect age or verify parental consent. No age eligibility or child-data compliance is established by this page.</p>
      <p>The API currently labels consent records with privacy and terms version “draft-2026-10-27”. Updating this text does not change those labels or re-consent existing records. The owner must reconcile notice versioning and any necessary fresh consent before relying on it for public collection.</p>
    </>,
  },
];

const termsSections: LegalSection[] = [
  {
    id: 'service',
    title: '1. The current pre-launch website',
    body: <><p>HABLAR is developing a human listening space. This website introduces that idea and lets you request one launch update. It does not currently provide a listening session, clinical service, account, booking, or paid subscription. Descriptions of a future service are intentions, not guarantees that a particular feature or service will launch.</p><p>The HABLAR name is a project name. The operator’s legal identity, business address and country of establishment remain for owner/legal confirmation; this page does not invent a contracting entity.</p></>,
  },
  {
    id: 'signup',
    title: '2. Requesting a launch update',
    body: <><p>Signing up is optional. Provide an email address, a phone number, or both that you control and are entitled to use. Do not submit another person’s contact details without authority. The form asks separately for consent to process those details solely for one launch update and acceptance of these Terms.</p><p>A confirmation means the API accepted the submission; duplicate contacts receive the same message and may retain their original record. It is not a guarantee of delivery, a launch date, priority access, a reserved session or a contractual promise of future service. No payment is collected by this form.</p><p>Read the <Link href="/privacy">Privacy Notice</Link> for the verified data flow, the limits of current request handling and details still requiring owner confirmation. Terms acceptance does not replace privacy consent or waive statutory rights.</p></>,
  },
  {
    id: 'conduct',
    title: '3. Using this website responsibly',
    body: <><p>Use the website lawfully. Do not spam submissions, impersonate someone, submit malicious content, interfere with the service, or attempt unauthorized access to records or systems. Do not place health information, personal stories, complaints or identity documents in the launch form: it is for contact details only.</p><p>Eligibility, age limits and any guardian-consent requirements for a future listening service have not been established here. These Terms do not introduce an age threshold or represent that required child/guardian safeguards already exist. The owner must resolve those requirements before offering any affected service.</p></>,
  },
  {
    id: 'availability',
    title: '4. Availability and changes',
    body: <><p>The website and the proposed service are in a pre-launch stage. Availability, features and timing may change; the site may be interrupted, contain errors or be discontinued. Do not rely on it being continuously available or on receiving an update by a particular date.</p><p>Any future listening service needs service-specific terms and privacy information when its actual features and operations are known. Updating these pages does not authorize a new use of your contact data. Check the displayed review date when returning; material changes requiring consent must be handled separately.</p></>,
  },
  {
    id: 'safety',
    title: '5. Safety limits and urgent help',
    body: <><p>HABLAR is not therapy, diagnosis, medical advice, professional mental-health care or emergency support. A human listening space is not a substitute for qualified professional care. The current website does not monitor your wellbeing, provide a crisis response or arrange emergency intervention.</p><p>If you or someone else may be in immediate danger, contact local emergency services or a trusted person who can help in person. Do not wait for a HABLAR launch update or use the form for urgent help.</p><p>No promise of absolute safety, anonymity or confidentiality is made by this pre-launch site. The launch form collects identifying contact details; encryption does not make those records anonymous. Future listening arrangements and safety processes require separate explanation before use.</p></>,
  },
  {
    id: 'complaints',
    title: '6. Questions, complaints and privacy requests',
    body: <><p><strong>Owner action required:</strong> a verified operator contact and monitored general complaint/grievance channel have not been supplied. No email address or officer name is invented here. The launch form is not a complaint channel, and this page cannot promise delivery or resolution of a complaint until the owner publishes a working route.</p><p>For access, correction, erasure, withdrawal and applicable regulator escalation, read <Link href="/privacy#requests">Privacy Notice: requests and grievances</Link>. The owner must publish and test the general and privacy contact routes before public collection. Do not put a complaint or extra personal information in a sign-up field.</p></>,
  },
  {
    id: 'legal',
    title: '7. Applicable rights and matters for legal review',
    body: <><p>Nothing here is intended to exclude mandatory consumer or data-protection rights or limit liability where doing so would be unlawful. This page does not set a liability cap, require arbitration, choose a governing law or court, or establish a business jurisdiction. Those business and legal decisions are not verified and remain for owner/legal review.</p><p>These Terms address the current website only. They are not legal advice or a claim of legal certification. The operator’s identity, complaint route, jurisdiction and any service-specific eligibility and operating terms must be confirmed before these are treated as finalized service terms.</p></>,
  },
];

export default function LegalPage({ page, footer }: { page: 'privacy' | 'terms'; footer: ReactNode }) {
  const title = page === 'privacy' ? 'Privacy Notice' : 'Terms & Conditions';
  const sections = page === 'privacy' ? privacySections : termsSections;
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${title} | HABLAR`;
    const description = `${title} for HABLAR’s pre-launch website, including current practices and matters requiring owner and legal review.`;
    const metadata = [
      ['meta[name="description"]', description],
      ['meta[property="og:title"]', document.title],
      ['meta[property="og:description"]', description],
      ['meta[name="twitter:title"]', document.title],
      ['meta[name="twitter:description"]', description],
    ].map(([selector, value]) => {
      const element = document.querySelector<HTMLMetaElement>(selector);
      const previous = element?.content;
      if (element) element.content = value;
      return { element, previous };
    });
    // Wouter preserves scroll between routes; open each policy at its heading or named section.
    const target = document.getElementById(window.location.hash.slice(1) || 'legal-main');
    target?.focus({ preventScroll: true });
    if (window.location.hash) target?.scrollIntoView({ behavior: 'instant' });
    else window.scrollTo({ top: 0, behavior: 'instant' });
    return () => {
      document.title = previousTitle;
      metadata.forEach(({ element, previous }) => {
        if (element && previous !== undefined) element.content = previous;
      });
    };
  }, [page, title]);

  return (
    <div className="legal-page">
      <a className="legal-skip" href="#legal-main">Skip to legal content</a>
      <header className="legal-top">
        <Link href="/" className="brand-mini" aria-label="HABLAR home">
          <img src={`${import.meta.env.BASE_URL}brand/hablar-logo-reference.jpeg`} alt="HABLAR" />
        </Link>
        <nav aria-label="Legal pages">
          <Link href="/privacy" aria-current={page === 'privacy' ? 'page' : undefined}>Privacy Notice</Link>
          <Link href="/terms" aria-current={page === 'terms' ? 'page' : undefined}>Terms &amp; Conditions</Link>
        </nav>
      </header>
      <main id="legal-main" tabIndex={-1} className="legal-content" aria-labelledby="legal-title">
        <Link className="legal-back legal-back-top" href="/"><ArrowLeft size={16} aria-hidden="true" /> Back to HABLAR</Link>
        <article>
          <span className="section-kicker">HABLAR / Pre-launch website</span>
          <h1 id="legal-title">{title}</h1>
          <p className="legal-date">Content reviewed: <time dateTime="2026-10-27">27 October 2026</time></p>
          <aside className="legal-review" aria-label="Outstanding owner and legal review">
            <strong>Important details still need owner and legal review.</strong>
            <p>This page explains the current website, but the operator’s identity, working contact route, retention schedule and full provider/transfer details are not yet confirmed. Unresolved items are explicitly identified below. Do not treat this as a finalized compliance notice or legal certification. These gaps should be resolved before public sign-ups.</p>
          </aside>
          <nav className="legal-toc" aria-label={`${title} contents`}>
            <h2>On this page</h2>
            <ol>{sections.map((section) => <li key={section.id}><a href={`#${section.id}`}>{section.title.replace(/^\d+\. /, '')}</a></li>)}</ol>
          </nav>
          {sections.map((section) => (
            <section id={section.id} tabIndex={-1} aria-labelledby={`${section.id}-heading`} key={section.id}>
              <h2 id={`${section.id}-heading`}>{section.title}</h2>
              {section.body}
            </section>
          ))}
          <Link className="legal-back" href="/"><ArrowLeft size={16} aria-hidden="true" /> Back to HABLAR</Link>
        </article>
      </main>
      {footer}
    </div>
  );
}

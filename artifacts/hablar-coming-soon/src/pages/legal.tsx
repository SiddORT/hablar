import { useEffect, type ReactNode } from 'react';
import { Link } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { ThemeSelector } from '@/components/theme-selector';
import { BrandLogo } from '@/components/brand-logo';

type LegalSection = { id: string; title: string; body: ReactNode };

const privacySections: LegalSection[] = [
  {
    id: 'scope',
    title: '1. Who is responsible and what this notice covers',
    body: <>
      <p>HABLAR is the company name used in this notice. Our current pre-launch website introduces HABLAR and offers an optional form to request one launch update. The website does not offer a listening service, accounts, or conversations.</p>
      <p><strong>Owner/legal review required:</strong> the operator’s legal name, address, country of establishment, data-controller (GDPR) or Data Fiduciary (India) identity, and privacy/grievance contact have not been supplied. Any required representative or Data Protection Officer must also be confirmed. These are unresolved disclosures, not finalized business facts.</p>
    </>,
  },
  {
    id: 'data',
    title: '2. Information collected and how sign-up works',
    body: <>
      <p>You may provide an email address, a phone number, or both. At least one is required to sign up. The browser sends these details, your consent, and your signup-agreement acceptance to HABLAR’s API. The API validates them, lowercases and trims email addresses, and checks phone numbers in international format. The calling-code selector helps format the number; it is not a request for your location.</p>
      <p>The sign-up record contains encrypted contact fields, keyed lookup digests to detect duplicates, a record identifier, encryption-key version, creation and consent timestamps, and consent, privacy-notice and agreement version labels. Only submissions with active consent and signup-agreement acceptance are accepted. Duplicate submissions may leave the earlier record unchanged; the same on-screen acknowledgment is shown for new and existing contacts to avoid revealing who signed up. A genuinely new signup triggers one administrator email with its submission time and any supplied email address and/or phone number. It does not include request or consent details.</p>
      <p>The form does not ask for a name, password, date of birth, or health information. Please do not put personal stories or sensitive information in contact fields. A phone number may reveal a country calling code. Network requests also expose technical information such as an IP address and browser/request metadata to the infrastructure handling them; the API uses the remote address for rate limiting. These are not columns in the sign-up record. Infrastructure logging and its retention need owner confirmation.</p>
    </>,
  },
  {
    id: 'purpose',
    title: '3. Purpose, consent and your choice',
    body: <>
      <p>The stated purpose of collecting your contact details is to send one HABLAR launch update, not ongoing marketing or SMS. If you provide an email address for a new signup, HABLAR sends one confirmation with the subject “You’re on the list — HABLAR is coming soon.” It confirms that your signup was recorded; it is not the launch update. HABLAR may send the one launch update when it is ready; no launch date is promised. A new signup also triggers one administrator email with the submission time and any email address and/or phone number you provided. Phone-only signups do not receive email, and duplicates do not trigger additional messages.</p>
      <p>You choose whether to sign up and which contact method to provide. You can browse without signing up. The consent checkbox is not preselected. Consent for the launch update is separate from agreeing to the signup terms. Where GDPR applies, consent is the intended basis for this contact use; the owner must confirm the legal basis for any separate infrastructure/security processing. Where applicable and in force, the DPDP Act also requires valid consent for this stated purpose.</p>
      <p>You may withdraw consent at any time without affecting the lawfulness of processing before withdrawal. Withdrawal should stop future consent-based launch contact. It does not automatically make earlier processing unlawful. The current site has no withdrawal control. Not submitting avoids this collection; closing the page after submitting does not withdraw consent or delete a saved record.</p>
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
      <p>The website requests DM Sans, Montserrat and Inter through Google Fonts, requesting styles from Google’s font service and font files from its delivery servers. Those requests disclose network information such as your IP address and browser/request metadata to Google; the font request is separate from sign-up and does not intentionally send your form fields. See <a href="https://developers.google.com/fonts/faq/privacy">Google Fonts’ privacy explanation</a>.</p>
      <p>For new signups, the application uses an SMTP email service configured by the HABLAR operator to send the signup confirmation and an administrator notification. The confirmation includes the recipient email address. The administrator notification includes the submission time and any email address and/or phone number supplied, but not consent or request metadata. Email delivery may fail; the signup remains saved. Phone-only entries trigger the administrator email but do not receive a confirmation email.</p>
      <p><strong>Owner/legal review required:</strong> the SMTP provider identity and contracting entity are not established by this notice and must be confirmed from the operator’s configuration before the provider can be named. Also confirm the live hosting and database providers, subprocessors, authorized recipients, processing/storage countries, log and backup locations, and launch-message provider. Where data crosses borders, confirm applicable GDPR transfer grounds and safeguards (such as an adequacy decision or appropriate contractual safeguards), how to obtain a copy, and any applicable Indian transfer restrictions. No specific storage country, transfer mechanism, processor agreement or localization guarantee is verified here.</p>
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
      <p>India’s DPDP framework has phased commencement. The owner must verify which provisions and rules are in force for HABLAR’s activities at the relevant time rather than treat all provisions as already applicable. Rights are not waived by accepting the signup agreement.</p>
    </>,
  },
  {
    id: 'review',
    title: '9. Notice updates and future service',
    body: <>
      <p>This notice describes the current pre-launch website and optional launch-update form. A future listening service or new data use would need its own accurate disclosures before it starts. Changes to this page do not by themselves grant consent to a new purpose.</p>
      <p><strong>Before public collection, the owner and legal adviser must resolve:</strong> operator identity and jurisdiction; privacy and grievance routes; legal bases and applicable commencement dates; provider/recipient and transfer details; retention and rights handling; and any required child/guardian-consent safeguards. The form does not collect age or verify parental consent. No age eligibility or child-data compliance is established by this page.</p>
      <p>The API labels consent records with privacy notice version “draft-2026-10-28”; signup-agreement acceptance remains recorded under the existing terms version. Updating this text does not re-consent existing records. The owner must reconcile notice versioning and any necessary fresh consent before relying on it for public collection.</p>
    </>,
  },
];

export default function LegalPage({ footer }: { footer: ReactNode }) {
  const title = 'Privacy Notice';
  const sections = privacySections;
  useEffect(() => {
    // Wouter preserves scroll between routes; open each policy at its heading or named section.
    const target = document.getElementById(window.location.hash.slice(1) || 'legal-main');
    target?.focus({ preventScroll: true });
    if (window.location.hash) target?.scrollIntoView({ behavior: 'instant' });
    else {
      const scrollport = document.querySelector<HTMLElement>('.app-scrollport');
      if (scrollport) scrollport.scrollTo({ top: 0, behavior: 'instant' });
      else window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, []);

  return (
    <div className="legal-page">
      <a className="legal-skip" href="#legal-main">Skip to legal content</a>
      <header className="legal-top">
        <Link href="/" className="brand-mini" aria-label="HABLAR home">
          <BrandLogo
            src={`${import.meta.env.BASE_URL}brand/hablar-logo-reference.jpeg`}
            alt="HABLAR"
          />
        </Link>
        <nav aria-label="Legal pages">
          <Link href="/privacy" aria-current="page">Privacy Notice</Link>
        </nav>
        <ThemeSelector />
      </header>
      <main id="legal-main" tabIndex={-1} className="legal-content" aria-labelledby="legal-title">
        <Link className="legal-back legal-back-top" href="/"><ArrowLeft size={16} aria-hidden="true" /> Back to HABLAR</Link>
        <article>
          <span className="section-kicker">HABLAR / Pre-launch website</span>
          <h1 id="legal-title">{title}</h1>
          <p className="legal-date">Content reviewed: <time dateTime="2026-10-28">28 October 2026</time></p>
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

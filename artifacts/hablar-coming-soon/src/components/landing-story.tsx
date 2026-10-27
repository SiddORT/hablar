import { Link } from 'wouter';
import { ShieldCheck, Phone, LockKeyhole } from 'lucide-react';
import './landing-story.css';

export function AboutServices() {
  return (
    <section className="ls-wrap" id="about" aria-labelledby="about-heading">
      <div className="ls-inner">
        <div className="ls-about">
          <span className="section-kicker">About HABLAR</span>
          <h2 id="about-heading" className="ls-title">More connected than ever. Still, so many feel unheard.</h2>
          <p className="ls-lede">Sometimes, all you need is to be heard. HABLAR is being built to offer a space where you can speak out and express yourself freely, because the first step toward feeling better can be knowing you are not alone in the journey.</p>
        </div>

        <div className="ls-services" id="services" aria-labelledby="services-heading">
          <div className="ls-services-head">
            <span className="section-kicker">Our services <em className="ls-tag">Planned, not yet available</em></span>
            <h2 id="services-heading" className="ls-title">A space to talk freely, when we open.</h2>
            <p>We intend to offer a space where you can talk through your thoughts or a difficult moment, and be listened to.</p>
          </div>
          <ul className="ls-nos" role="list">
            <li>No labels</li><li>No assumptions</li><li>No judgment</li><li>Just real conversation</li>
          </ul>
          <div className="ls-cols">
            <p>We believe being heard can make a difference. Our hope is that a conversation at HABLAR, in that very moment, might bring a little clarity, comfort, or a fresh perspective, and a reminder that you matter, and so do your feelings and thoughts.</p>
            <p>We aim to make it a warm space where you can speak freely, cry if you need to, laugh if you want to, or simply sit in silence with someone there. A reminder that you are not alone.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Philosophy() {
  return (
    <section className="ls-philo" id="philosophy" aria-labelledby="philosophy-heading">
      <div className="ls-inner ls-philo-grid">
        <div>
          <span className="section-kicker">HABLAR philosophy</span>
          <h2 id="philosophy-heading" className="ls-title">Not your identity. Your story.</h2>
        </div>
        <div className="ls-philo-copy">
          <p>At HABLAR, we do not want you to have to explain who you are, where you are from, or share more than you are comfortable with. Our aim is a space where your thoughts, feelings and story come first, so you can be truly yourself.</p>
          <p className="ls-note">How anonymity and confidentiality would work in a future service, including their limits, will need to be clearly explained before anyone uses it. Nothing here guarantees them today.</p>
          <p>Putting endless thoughts into words can help you see things more clearly. Sharing what you have been holding may help you feel lighter, and can bring new perspectives. Sometimes, all you need is a genuine conversation with someone willing to listen the way you want.</p>
          <p>In a world increasingly shaped by technology and artificial intelligence, we believe human connection matters: behind every conversation is a person with emotions and a story. Every story deserves a space, and every person deserves to be heard.</p>
        </div>
      </div>
    </section>
  );
}

export function PurposeMission() {
  return (
    <section className="ls-wrap" id="purpose" aria-label="Our purpose and mission">
      <div className="ls-inner ls-pm">
        <article className="ls-pm-card a">
          <span className="section-kicker">Our purpose</span>
          <h3>To give people a safe space to talk and be heard.</h3>
          <p>Simple, and deeply meaningful to us.</p>
        </article>
        <article className="ls-pm-card b" id="mission">
          <span className="section-kicker">Our mission</span>
          <h3>A space where everyone feels heard, valued, and free to express themselves.</h3>
          <p>We believe talking can help ease loneliness and foster meaningful human conversations in an increasingly AI-driven world.</p>
        </article>
      </div>
    </section>
  );
}

export function SafetyPrivacy() {
  return (
    <section className="ls-wrap ls-safety-wrap" id="safety-privacy" aria-labelledby="safety-heading">
      <div className="ls-inner">
        <span className="section-kicker">Safety &amp; privacy</span>
        <h2 id="safety-heading" className="ls-title">Clear about what this site is, and is not.</h2>
        <div className="ls-safety">
          <div className="ls-block">
            <ShieldCheck size={20} aria-hidden="true" />
            <h3>Safety limits</h3>
            <p>HABLAR is not therapy, diagnosis, medical advice, professional mental-health care, counselling or emergency support, and is not a substitute for professional care. This site does not monitor wellbeing or provide a crisis response.</p>
          </div>
          <div className="ls-block urgent">
            <Phone size={20} aria-hidden="true" />
            <h3>If you need help now</h3>
            <p>If you or someone else may be in immediate danger, contact local emergency services or a trusted person nearby. If you need professional care, please reach out to a qualified professional. Do not wait for a launch update.</p>
          </div>
          <div className="ls-block">
            <LockKeyhole size={20} aria-hidden="true" />
            <h3>What we collect today</h3>
            <p>The form asks for an email and/or phone number, with separate launch-update consent and terms acceptance, for one launch update. Stored contact fields are encrypted, but remain personal data, not anonymous data. Sign-up also records consent evidence, and infrastructure receives technical information such as your IP address. No system is absolutely secure or confidential. Please use the form for contact details only, not personal stories, financial details or other sensitive or identifying information.</p>
          </div>
          <div className="ls-block">
            <h3>Not built yet</h3>
            <p>There are no accounts, calls or payment processing here. Any future listening service, including how listeners, anonymity and confidentiality would work, will need its own disclosures before use.</p>
          </div>
        </div>
        <p className="ls-legal">Read the draft <Link href="/privacy" data-testid="link-safety-notice">Privacy Notice</Link> and <Link href="/terms" data-testid="link-safety-terms">Terms &amp; Conditions</Link> for data use, access and disclosure details. Operator identity, a working privacy-request contact route, retention and provider details are still awaiting owner and legal review. These gaps should be resolved before public sign-ups.</p>
      </div>
    </section>
  );
}

export function ClosingLine() {
  return (
    <section className="ls-closing" aria-label="HABLAR closing line">
      <p>HABLAR — Come as you are. <span>Speak as you feel.</span></p>
    </section>
  );
}

export default function LandingStory() {
  return (
    <>
      <AboutServices />
      <Philosophy />
      <PurposeMission />
      <SafetyPrivacy />
      <ClosingLine />
    </>
  );
}

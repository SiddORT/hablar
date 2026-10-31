import { useRef, useState, type PointerEvent } from 'react';
import { Link } from 'wouter';
import { ShieldCheck, Phone, LockKeyhole } from 'lucide-react';
import './landing-story.css';
import './landing-about-refresh.css';
import './purpose-mission-flip.css';

export function ListeningMoment() {
  return (
    <section className="listening-moment" id="listening-moment" aria-labelledby="listening-moment-heading">
      <div className="listening-moment__inner">
        <header className="listening-moment__heading hr-reveal">
          <h2 id="listening-moment-heading">A moment to be <span>heard</span></h2>
        </header>
        <p className="listening-moment__intro hr-reveal">
          <span className="listening-moment__rainbow">Maybe you don’t need advice.</span>
          <span className="listening-moment__rainbow">Maybe you don’t need answers.</span>
          <span className="listening-moment__rainbow">Maybe you just need someone to listen.</span>
        </p>
        <p className="listening-moment__signoff hr-reveal">Come as you are Speak as you feel</p>
        <ul className="listening-moment__capsules hr-reveal" aria-label="What to expect from a conversation">
          <li>No labels</li>
          <li>No assumptions</li>
          <li>No judgment</li>
          <li>Just real conversations</li>
        </ul>
      </div>
    </section>
  );
}

export function OurServices() {
  return (
    <section className="our-services" id="our-services" aria-labelledby="our-services-heading">
      <div className="our-services__decor" aria-hidden="true">
        <span className="our-services__blob our-services__blob--tl1" />
        <span className="our-services__blob our-services__blob--tl2" />
        <span className="our-services__blob our-services__blob--br1" />
        <span className="our-services__blob our-services__blob--br2" />
      </div>
      <div className="our-services__inner">
        <span className="our-services__eyebrow">Coming soon</span>
        <span className="our-services__rule" aria-hidden="true" />
        <h2 id="our-services-heading">Our services</h2>
        <p>We offer a space where you can talk freely, navigating through your thoughts or a difficult moment. We’re here to listen - No labels; No assumptions; No judgment; Just real conversations; genuine support and a reminder that someone is here to hear you.</p>
        <hr className="our-services__divider" aria-hidden="true" />
        <p>We believe that being heard can make a difference.</p>
        <p>A conversation at HABLAR, at that very moment can bring in clarity, comfort, and a fresh perspective. It’s a reminder that you matter, your feelings matter, your thoughts matter.</p>
      </div>
    </section>
  );
}

export function AboutHablar() {
  return (
    <section className="hablar-refresh hablar-about" id="about" aria-labelledby="about-heading">
      <div className="ha-shell">
        <div className="ha-copy">
          <header className="ha-heading hr-reveal">
            <span className="ha-eyebrow"><span className="ha-spark" aria-hidden="true" /> About HABLAR</span>
            <h2 id="about-heading">A moment to be heard</h2>
          </header>
          <div className="ha-messages">
            <p className="ha-message ha-message--lead hr-reveal">
              In a world more connected than ever, millions of people still <span className="ha-emphasis">feel unheard</span>. In such times, all you need is to <span className="ha-emphasis">be heard</span>.
            </p>
            <p className="ha-message ha-message--second hr-reveal">
              HABLAR offers a safe and anonymous space for you to speak out and express yourself freely.
            </p>
            <p className="ha-message ha-message--third hr-reveal">
              Because the first step toward feeling better is knowing you're not alone in the journey.
            </p>
          </div>
        </div>
        <div className="ha-art-frame hr-reveal" aria-hidden="true">
          <div className="ha-art">
            <span className="ha-art__halo" />
            <span className="ha-art__form ha-art__form--peach" />
            <span className="ha-art__form ha-art__form--lilac" />
            <span className="ha-art__form ha-art__form--sage" />
            <span className="ha-art__orbit ha-art__orbit--one" />
            <span className="ha-art__orbit ha-art__orbit--two" />
            <span className="ha-art__orbit ha-art__orbit--three" />
            <span className="ha-art__orbit ha-art__orbit--four" />
            <span className="ha-art__planet ha-art__planet--pink" />
            <span className="ha-art__planet ha-art__planet--blue" />
            <span className="ha-art__spark ha-art__spark--one" />
            <span className="ha-art__spark ha-art__spark--two" />
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
          <p className="ls-note">How anonymity and confidentiality would work in a future service, including their limits, will need to be clearly explained before anyone uses it.</p>
          <p>Putting endless thoughts into words can help you see things more clearly. Sharing what you have been holding may help you feel lighter, and can bring new perspectives. Sometimes, all you need is a genuine conversation with someone willing to listen the way you want.</p>
          <p>In a world increasingly shaped by technology and artificial intelligence, we believe human connection matters: behind every conversation is a person with emotions and a story. Every story deserves a space, and every person deserves to be heard.</p>
        </div>
      </div>
    </section>
  );
}

type VisionMissionCardProps = {
  id: string;
  label: string;
  detail: string;
  tone: 'rose' | 'mint';
};

function VisionMissionCard({ id, label, detail, tone }: VisionMissionCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const frontButtonRef = useRef<HTMLButtonElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const title = label.replace(/^Our /, '');

  const showBack = () => {
    setIsFlipped(true);
    requestAnimationFrame(() => backButtonRef.current?.focus());
  };

  const showFront = () => {
    setIsFlipped(false);
    requestAnimationFrame(() => frontButtonRef.current?.focus());
  };

  const handlePointerEnter = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse') setIsFlipped(true);
  };

  const handlePointerLeave = () => {
    if (!cardRef.current?.contains(document.activeElement)) setIsFlipped(false);
  };

  return (
    <article
      ref={cardRef}
      className={`pm-card pm-card--${tone}${isFlipped ? ' is-flipped' : ''}`}
      aria-label={label}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsFlipped(false);
        }
      }}
    >
      <div className="pm-card-inner">
        <div className="pm-face pm-front" aria-hidden={isFlipped}>
          <h3 id={`${id}-title`}>Our <span>{title}</span></h3>
          <button
            ref={frontButtonRef}
            type="button"
            className="pm-cue"
            tabIndex={isFlipped ? -1 : 0}
            aria-expanded={isFlipped}
            aria-controls={`${id}-detail`}
            onClick={showBack}
          >
            Hover or tap to flip
          </button>
        </div>
        <div className="pm-face pm-back" aria-hidden={!isFlipped}>
          <span className="pm-kicker">{label}</span>
          <span className="pm-rule" aria-hidden="true" />
          <p className="pm-detail" id={`${id}-detail`}>{detail}</p>
          <button
            ref={backButtonRef}
            type="button"
            className="pm-cue"
            tabIndex={isFlipped ? 0 : -1}
            aria-expanded={isFlipped}
            aria-controls={`${id}-detail`}
            onClick={showFront}
          >
            Back to the front
          </button>
        </div>
      </div>
    </article>
  );
}

export function PurposeMission() {
  return (
    <section className="ls-wrap" id="purpose" aria-label="Our purpose and mission">
      <h2 className="sr-only">Our purpose and mission</h2>
      <div className="ls-inner ls-pm">
        <VisionMissionCard
          id="vision-card"
          label="Our purpose"
          detail="Our purpose is simple yet deeply meaningful: to give people a safe space to talk and be heard."
          tone="rose"
        />
        <VisionMissionCard
          id="mission-card"
          label="Our mission"
          detail="Our mission is to create a space where everyone feels heard, valued, and free to express themselves. Talking helps combat loneliness and fosters meaningful human conversations in increasingly AI-driven world."
          tone="mint"
        />
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
            <p>The form asks for an email and/or phone number, with separate launch-update consent and a required signup agreement, for one launch update. Stored contact fields are encrypted, but remain personal data, not anonymous data. Sign-up also records consent evidence, and infrastructure receives technical information such as your IP address. No system is absolutely secure or confidential. Please use the form for contact details only, not personal stories, financial details or other sensitive or identifying information.</p>
          </div>
          <div className="ls-block">
            <h3>Not built yet</h3>
            <p>There are no accounts, calls or payment processing here. Any future listening service, including how listeners, anonymity and confidentiality would work, will need its own disclosures before use.</p>
          </div>
        </div>
        <p className="ls-legal">The <Link href="/privacy" data-testid="link-safety-notice">Privacy Notice</Link> explains how the optional launch-update form works and what information it uses. HABLAR’s listening service is still in development and is not available through this website.</p>
      </div>
    </section>
  );
}

export default function LandingStory() {
  return (
    <>
      <ListeningMoment />
      <OurServices />
      <PurposeMission />
      <AboutHablar />
      <Philosophy />
      <SafetyPrivacy />
    </>
  );
}

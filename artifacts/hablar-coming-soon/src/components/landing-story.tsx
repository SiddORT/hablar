import { useRef, useState, type PointerEvent } from 'react';
import { Link } from 'wouter';
import { Ear, MessageCircleMore, ShieldCheck, Phone, LockKeyhole, type LucideIcon } from 'lucide-react';
import './landing-story.css';
import './landing-about-refresh.css';
import './purpose-mission-flip.css';

export function ListeningMoment() {
  return (
    <section className="listening-moment" id="listening-moment" aria-labelledby="listening-moment-heading">
      <div className="listening-moment__inner">
        <header className="listening-moment__heading hr-reveal">
          <h2 id="listening-moment-heading">A moment to be heard</h2>
        </header>
        <div className="listening-moment__messages">
          <p className="hr-reveal">Maybe you don’t need advice.</p>
          <p className="hr-reveal">Maybe you don’t need answers.</p>
          <p className="hr-reveal">Maybe you just need someone to listen.</p>
          <p className="listening-moment__reassurance hr-reveal">You don’t have to carry every thought alone!</p>
        </div>
        <ul className="listening-moment__capsules hr-reveal" aria-label="What to expect from a conversation">
          <li>No labels</li>
          <li>No assumptions</li>
          <li>No judgment</li>
          <li>Just real conversations</li>
        </ul>
        <p className="listening-moment__coming-soon hr-reveal">We’re coming soon</p>
        <p className="listening-moment__signoff hr-reveal">Come as you are. Speak as you feel.</p>
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
              In a world more connected than ever, millions of people still feel unheard. In such times, all you need is to be heard.
            </p>
            <p className="ha-message ha-message--second hr-reveal">
              HABLAR offers a safe and anonymous space for you to speak out and express yourself freely.
            </p>
            <p className="ha-message ha-message--third hr-reveal">
              Because the first step toward feeling better is knowing you're not alone in the journey.
            </p>
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
  icon: LucideIcon;
  tone: 'rose' | 'mint';
};

function VisionMissionCard({ id, label, detail, icon: Icon, tone }: VisionMissionCardProps) {
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
          <span className="pm-artwork" aria-hidden="true">
            <Icon className="pm-icon" strokeWidth={1.8} />
          </span>
          <span className="pm-spark pm-spark--one" aria-hidden="true" />
          <span className="pm-spark pm-spark--two" aria-hidden="true" />
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
          icon={MessageCircleMore}
          tone="rose"
        />
        <VisionMissionCard
          id="mission-card"
          label="Our mission"
          detail="Our mission is to create a space where everyone feels heard, valued, and free to express themselves. Talking helps combat loneliness and fosters meaningful human conversations in increasingly AI-driven world."
          icon={Ear}
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
      <PurposeMission />
      <ListeningMoment />
      <AboutHablar />
      <Philosophy />
      <SafetyPrivacy />
      <ClosingLine />
    </>
  );
}

import { useRef, useState, type PointerEvent } from 'react';
import { Ear, MessageCircleMore, type LucideIcon } from 'lucide-react';
import './_group.css';
import './reference.css';

type CardProps = {
  id: string;
  label: string;
  detail: string;
  icon: LucideIcon;
  tone: 'rose' | 'mint';
};

function ReferenceFlipCard({ id, label, detail, icon: Icon, tone }: CardProps) {
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
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsFlipped(false);
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

export function Reference() {
  return (
    <section className="pm-reference" aria-label="Our purpose and mission">
      <h2 className="sr-only">Our purpose and mission</h2>
      <div className="pm-grid">
        <ReferenceFlipCard
          id="reference-purpose"
          label="Our purpose"
          detail="Our purpose is simple yet deeply meaningful: to give people a safe space to talk and be heard."
          icon={MessageCircleMore}
          tone="rose"
        />
        <ReferenceFlipCard
          id="reference-mission"
          label="Our mission"
          detail="Our mission is to create a space where everyone feels heard, valued, and free to express themselves. Talking helps combat loneliness and fosters meaningful human conversations in increasingly AI-driven world."
          icon={Ear}
          tone="mint"
        />
      </div>
    </section>
  );
}

import { useRef, useState, type PointerEvent } from 'react';
import { Ear, MessageCircleHeart, type LucideIcon } from 'lucide-react';
import './_group.css';
import './current.css';

type CardProps = {
  id: string;
  label: string;
  detail: string;
  icon: LucideIcon;
};

function VisionMissionCard({ id, label, detail, icon: Icon }: CardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const frontButtonRef = useRef<HTMLButtonElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);

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
      className={`pm-flip-card${isFlipped ? ' is-flipped' : ''}`}
      aria-label={label}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsFlipped(false);
        }
      }}
    >
      <div className="pm-flip-inner">
        <div className="pm-flip-face pm-flip-front" aria-hidden={isFlipped}>
          <span className="pm-front-artwork" aria-hidden="true">
            <Icon className="pm-front-icon" strokeWidth={1.6} />
          </span>
          <h3 id={`${id}-title`}>{label}</h3>
          <button ref={frontButtonRef} type="button" className="pm-flip-cue" tabIndex={isFlipped ? -1 : 0} aria-expanded={isFlipped} aria-controls={`${id}-detail`} onClick={showBack}>
            Hover or tap to flip
          </button>
        </div>
        <div className="pm-flip-face pm-flip-back" aria-hidden={!isFlipped}>
          <span className="pm-back-label">{label}</span>
          <p className="pm-detail" id={`${id}-detail`}>{detail}</p>
          <button ref={backButtonRef} type="button" className="pm-flip-cue" tabIndex={isFlipped ? 0 : -1} aria-expanded={isFlipped} aria-controls={`${id}-detail`} onClick={showFront}>
            Back to the front
          </button>
        </div>
      </div>
    </article>
  );
}

export function Current() {
  return (
    <section className="ls-wrap" aria-label="Our purpose and mission">
      <h2 className="sr-only">Our purpose and mission</h2>
      <div className="ls-inner ls-pm">
        <VisionMissionCard
          id="vision-card"
          label="Our purpose"
          detail="Our purpose is simple yet deeply meaningful: to give people a safe space to talk and be heard."
          icon={MessageCircleHeart}
        />
        <VisionMissionCard
          id="mission-card"
          label="Our mission"
          detail="Our mission is to create a space where everyone feels heard, valued, and free to express themselves. Talking helps combat loneliness and fosters meaningful human conversations in increasingly AI-driven world."
          icon={Ear}
        />
      </div>
    </section>
  );
}

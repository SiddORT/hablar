import {
  Ear,
  Lightbulb,
  MessagesSquare,
  Ban,
  Tag,
  UsersRound,
} from 'lucide-react';
import './services-section.css';

const principles = [
  { label: 'No labels', icon: Tag },
  { label: 'No assumptions', icon: UsersRound },
  { label: 'No judgment', icon: Ban },
  { label: 'Just real conversations', icon: MessagesSquare },
];

export function ServicesSection() {
  return (
    <section className="hablar-services" id="services" aria-labelledby="services-heading" data-testid="services-section">
      <div className="services-panel scroll-reveal">
        <div className="services-heading">
          <h2 id="services-heading" data-testid="services-heading">
            HABLAR is being built as a space for you.
            <br />
            {' '}<span>A reminder that you’re never truly alone.</span>
          </h2>
          <p className="services-intro">
            When HABLAR opens, we hope to offer a place to talk freely through your thoughts or a difficult moment. We aim to listen with genuine support—without labels, assumptions, or judgment—and remind you that someone is here to hear you.
          </p>
        </div>

        <ul className="services-principles" aria-label="Listening principles">
          {principles.map(({ label, icon: Icon }) => (
            <li className="services-chip" key={label}>
              <span className="services-chip-icon" aria-hidden="true"><Icon size={15} strokeWidth={1.8} /></span>
              <span>{label}</span>
            </li>
          ))}
        </ul>

        <div className="services-cards">
          <article className="service-card service-card--blush" data-testid="service-card-01">
            <span className="service-icon service-icon--blush" aria-hidden="true">
              <Lightbulb size={24} strokeWidth={1.6} />
            </span>
            <div className="service-card-copy">
              <span className="service-number">01</span>
              <p>
                We believe being heard can make a difference. A conversation with HABLAR may bring clarity, comfort, or a fresh perspective. We hope it reminds you that you matter—your feelings and thoughts matter, too.
              </p>
            </div>
          </article>
          <article className="service-card service-card--mint" data-testid="service-card-02">
            <span className="service-icon service-icon--mint" aria-hidden="true">
              <Ear size={25} strokeWidth={1.6} />
            </span>
            <div className="service-card-copy">
              <span className="service-number">02</span>
              <p>
                We hope to provide a warm, supportive space where you can speak freely, cry if you need to, laugh if you want to, or simply sit in silence knowing someone is there with you.
              </p>
            </div>
          </article>
        </div>

        <div className="services-wave" aria-hidden="true">
          <svg viewBox="0 0 1200 70" preserveAspectRatio="none">
            <path className="services-wave-fill" d="M0 28C155 68 271 8 425 30s220 38 370 5 259-29 405 5v30H0V28Z" />
            <path className="services-wave-line" d="M0 28C155 68 271 8 425 30s220 38 370 5 259-29 405 5" />
          </svg>
        </div>
      </div>
    </section>
  );
}

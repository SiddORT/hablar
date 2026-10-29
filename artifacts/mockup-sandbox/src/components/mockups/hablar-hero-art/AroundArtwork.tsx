import './_group.css';

const topics = [
  'relationships',
  'heartbreak',
  'friendship',
  'family',
  'marriage',
  'work',
  'sexuality',
  'trauma',
  'shame',
  'financial-situation',
  'guilt',
  'grief',
  'loss',
];

export function AroundArtwork() {
  return (
    <main className="hablar-hero-preview">
      <div className="hero-art hero-art--around-image">
        <svg
          className="hero-tag-structure"
          viewBox="0 0 460 430"
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <ellipse className="hero-orbit-line" cx="230" cy="215" rx="210" ry="190" />
          <circle className="hero-orbit-node" cx="145" cy="39" r="4" />
          <circle className="hero-orbit-node hero-orbit-node--accent" cx="315" cy="39" r="4" />
          <circle className="hero-orbit-node" cx="421" cy="91" r="4" />
          <circle className="hero-orbit-node hero-orbit-node--accent" cx="438" cy="178" r="4" />
          <circle className="hero-orbit-node" cx="438" cy="252" r="4" />
          <circle className="hero-orbit-node hero-orbit-node--accent" cx="421" cy="339" r="4" />
          <circle className="hero-orbit-node" cx="315" cy="391" r="4" />
          <circle className="hero-orbit-node hero-orbit-node--accent" cx="145" cy="391" r="4" />
          <circle className="hero-orbit-node" cx="39" cy="339" r="4" />
          <circle className="hero-orbit-node hero-orbit-node--accent" cx="22" cy="252" r="4" />
          <circle className="hero-orbit-node" cx="22" cy="178" r="4" />
          <circle className="hero-orbit-node hero-orbit-node--accent" cx="39" cy="91" r="4" />
        </svg>
        <img
          className="hero-connection-art"
          src="/__mockup/images/hablar-connection-silhouettes.png"
          alt=""
          aria-hidden="true"
        />
        <ul className="hero-topic-list" aria-label="Topics you may want to talk about">
          {topics.map((topic) => (
            <li className="hero-topic-item" key={topic}>
              <span className="hero-topic-hash" aria-hidden="true">#</span>
              <span>{topic}</span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

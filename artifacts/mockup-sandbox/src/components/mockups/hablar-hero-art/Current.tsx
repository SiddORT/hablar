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

export function Current() {
  return (
    <main className="hablar-hero-preview">
      <div className="hero-art hero-art--current">
        <svg
          className="hero-tag-structure"
          viewBox="0 0 460 430"
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <ellipse className="hero-orbit-line" cx="230" cy="215" rx="210" ry="190" />
          <ellipse className="hero-orbit-line hero-orbit-line--inner" cx="230" cy="215" rx="128" ry="102" />
          <path className="hero-orbit-connector" d="M78 52 Q120 82 156 129 M225 26 Q200 80 156 129 M225 26 Q273 71 304 129 M373 56 Q337 88 304 129" />
          <path className="hero-orbit-connector" d="M405 163 Q376 196 340 232 M368 331 Q311 305 230 301 M230 404 Q230 359 230 301 M83 344 Q112 286 129 232 M46 206 Q87 204 129 232" />
          <path className="hero-orbit-connector hero-orbit-connector--inner" d="M156 129 Q228 94 304 129 Q358 178 340 232 Q308 286 230 301 Q158 294 129 232 Q112 173 156 129Z" />
          <circle className="hero-orbit-node" cx="78" cy="52" r="4" />
          <circle className="hero-orbit-node hero-orbit-node--accent" cx="225" cy="26" r="4" />
          <circle className="hero-orbit-node" cx="373" cy="56" r="4" />
          <circle className="hero-orbit-node hero-orbit-node--accent" cx="405" cy="163" r="4" />
          <circle className="hero-orbit-node" cx="368" cy="331" r="4" />
          <circle className="hero-orbit-node hero-orbit-node--accent" cx="230" cy="404" r="4" />
          <circle className="hero-orbit-node" cx="83" cy="344" r="4" />
          <circle className="hero-orbit-node hero-orbit-node--accent" cx="46" cy="206" r="4" />
          <circle className="hero-orbit-node" cx="156" cy="129" r="3.5" />
          <circle className="hero-orbit-node hero-orbit-node--accent" cx="304" cy="129" r="3.5" />
          <circle className="hero-orbit-node" cx="340" cy="232" r="3.5" />
          <circle className="hero-orbit-node hero-orbit-node--accent" cx="230" cy="301" r="3.5" />
          <circle className="hero-orbit-node" cx="129" cy="232" r="3.5" />
        </svg>
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

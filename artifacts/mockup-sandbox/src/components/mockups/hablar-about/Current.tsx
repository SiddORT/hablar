import './_group.css';

export function Current() {
  return (
    <main className="min-h-screen">
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
    </main>
  );
}

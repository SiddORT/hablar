import './_group.css';
import './refreshed.css';

export function Refreshed() {
  return (
    <main className="hablar-refresh">
      <section className="hr-section" aria-labelledby="hr-about-heading">
        <div className="hr-shell">
          <header className="hr-intro hr-reveal">
            <span className="hr-eyebrow"><span className="hr-spark" aria-hidden="true" /> About HABLAR</span>
            <h1 id="hr-about-heading">More connected than ever.<br /><span>Still, so many feel unheard.</span></h1>
            <p className="hr-lede">Sometimes, all you need is to be heard.</p>
            <p className="hr-body">HABLAR is being built as a space where you can speak out and express yourself freely. Because a first step toward feeling better can be knowing you are not alone in the journey.</p>
            <div className="hr-signoff" aria-hidden="true"><span /> A little room to be heard</div>
          </header>

          <figure className="hr-photo hr-reveal" aria-label="A warm conversation among three people">
            <img src="/__mockup/images/hablar-listening-moment.png" alt="Three people sitting together in conversation, listening with care." />
            <figcaption><span className="hr-photo-mark" aria-hidden="true">H</span><span>A moment to listen.<br /><strong>A little room to be yourself.</strong></span></figcaption>
          </figure>

          <section className="hr-services hr-reveal" aria-labelledby="hr-services-heading">
            <div className="hr-services-top">
              <div>
                <span className="hr-eyebrow">Our services</span>
                <h2 id="hr-services-heading">A space to talk freely,<br /><em>when we open.</em></h2>
              </div>
              <p className="hr-status"><span className="hr-status-dot" aria-hidden="true" />Planned, not yet available</p>
            </div>
            <p className="hr-service-lede">We intend to offer a space where you can talk through your thoughts or a difficult moment, and be listened to.</p>
            <div className="hr-principles" aria-label="The spirit of future conversations">
              <span>No labels</span><span>No assumptions</span><span>No judgment</span><span className="hr-principle-last">Just real conversation</span>
            </div>
            <div className="hr-details">
              <article className="hr-detail">
                <span className="hr-detail-index" aria-hidden="true">01</span>
                <p>We believe being heard can make a difference. Our hope is that a conversation at HABLAR, in that very moment, might bring a little clarity, comfort, or a fresh perspective—and a reminder that you matter, and so do your feelings and thoughts.</p>
              </article>
              <article className="hr-detail">
                <span className="hr-detail-index" aria-hidden="true">02</span>
                <p>We aim to make it a warm space where you can speak freely, cry if you need to, laugh if you want to, or simply sit in silence with someone there. A reminder that you are not alone.</p>
              </article>
            </div>
            <p className="hr-closing">HABLAR <span>— Come as you are. Speak as you feel.</span></p>
          </section>
        </div>
      </section>
    </main>
  );
}

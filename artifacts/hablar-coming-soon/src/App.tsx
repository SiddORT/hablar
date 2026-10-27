import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ArrowDown, ArrowLeft, ArrowUpRight, Check, ShieldCheck, Sparkles } from 'lucide-react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
gsap.registerPlugin(ScrollTrigger);

function usePageMotion() {
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    const context = gsap.context(() => {
      gsap.fromTo('.hero-reveal', { opacity: 0, y: 22 }, {
        opacity: 1, y: 0, duration: .9, stagger: .13, ease: 'power3.out', delay: .12,
      });
      gsap.utils.toArray<HTMLElement>('.scroll-reveal').forEach((element) => {
        gsap.fromTo(element, { opacity: 0, y: 26 }, {
          opacity: 1, y: 0, duration: .78, ease: 'power2.out',
          scrollTrigger: { trigger: element, start: 'top 88%', once: true },
        });
      });
      gsap.to('.mascot-crop', {
        y: -8, duration: 2.4, repeat: -1, yoyo: true, ease: 'sine.inOut',
      });
    });
    return () => context.revert();
  }, []);
}

function Header() {
  return (
    <header className="topbar">
      <Link href="/" className="brand-mini" aria-label="HABLAR home">
        <img src="/brand/hablar-logo-reference.jpeg" alt="HABLAR — Your safe space to express" />
      </Link>
      <nav className="nav-links" aria-label="Main navigation">
        <a className="nav-plain" href="#how-it-works">How it feels</a>
        <a className="nav-plain" href="#our-promise">Our promise</a>
        <a className="nav-cta" href="#launch-note">Keep me posted</a>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <img src="/brand/hablar-logo-reference.jpeg" alt="HABLAR" />
          <p>A little more room to be human. Come as you are.</p>
        </div>
        <div className="footer-links">
          <a href="#how-it-works">How it feels</a>
          <Link href="/privacy">Privacy draft</Link>
          <Link href="/terms">Terms draft</Link>
          <a href="#launch-note">Launch updates</a>
        </div>
      </div>
      <p className="footer-note">HABLAR is a listening space, not therapy, diagnosis, professional mental-health care, or emergency support. If you may be in immediate danger, contact local emergency services or a trusted person nearby.</p>
    </footer>
  );
}

function Signup() {
  const [status, setStatus] = useState('');
  function previewSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get('email') || '').trim();
    const phone = String(data.get('phone') || '').trim();
    const consent = data.get('consent') === 'on';
    if (!email && !phone) {
      setStatus('Add an email address or phone number to preview the form.');
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus('Please check the email address format.');
      return;
    }
    if (!consent) {
      setStatus('Please choose whether you agree to receive a launch note.');
      return;
    }
    setStatus('Prototype only: nothing was sent or saved. Your details stay in this page only.');
    form.reset();
  }
  return (
    <section className="signup-section" id="launch-note">
      <div className="signup-panel scroll-reveal">
        <div>
          <span className="section-kicker">A note when we open?</span>
          <h2>Let the good news find you.</h2>
          <p>Leave an email, a phone number, or both. This is only a front-end preview, so your details will not leave this page.</p>
        </div>
        <form className="form-wrap" onSubmit={previewSubmit} noValidate>
          <label className="form-label" htmlFor="email">Email address <span style={{ fontWeight: 400, color: '#888' }}>— optional</span></label>
          <input className="contact-input" id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" />
          <label className="form-label" htmlFor="phone">Phone number <span style={{ fontWeight: 400, color: '#888' }}>— optional</span></label>
          <input className="contact-input" id="phone" name="phone" type="tel" autoComplete="tel" placeholder="+1 555 123 4567" />
          <label className="consent">
            <input type="checkbox" name="consent" required />
            <span>I consent to HABLAR using the contact details I provide for one launch update, as explained in the <Link href="/privacy" target="_blank" rel="noreferrer">Privacy Notice</Link>, and I agree to the <Link href="/terms" target="_blank" rel="noreferrer">Terms &amp; Conditions</Link>.</span>
          </label>
          <button className="button-primary form-submit" type="submit">Preview the sign-up <ArrowUpRight size={17} aria-hidden="true" /></button>
          <p className="prototype-note">Prototype only · No submission, API, or data storage is connected.</p>
          <p className="form-status" role="status" aria-live="polite">{status}</p>
        </form>
      </div>
    </section>
  );
}

function Home() {
  usePageMotion();
  return (
    <main className="site-shell">
      <Header />
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow hero-reveal"><i /> A listening space is on its way</span>
          <h1 className="hero-reveal">Your safe place <span>to express.</span></h1>
          <p className="hero-lede hero-reveal">Some days you need advice. Some days you just need someone to hear you. HABLAR is making space for the second one.</p>
          <div className="hero-actions hero-reveal">
            <a className="button-primary" href="#launch-note">Save me a seat <ArrowDown size={16} aria-hidden="true" /></a>
            <a className="button-quiet" href="#how-it-works">Get to know us</a>
          </div>
          <p className="hero-footnote hero-reveal">No fixing. No labels. Just a human being, listening.</p>
        </div>
        <div className="hero-art hero-reveal" aria-label="HABLAR brand artwork">
          <div className="floating-note one">A softer kind of space</div>
          <div className="scribble" aria-hidden="true" />
          <div className="logo-art"><img src="/brand/hablar-logo-reference.jpeg" alt="HABLAR, your safe space to express" /></div>
          <div className="floating-note two">Come as you are</div>
        </div>
      </section>

      <section className="story-band" id="how-it-works">
        <div className="story-inner">
          <div className="mascot-stage scroll-reveal" aria-label="Smiling HABLAR mascot">
            <Sparkles className="spark a" size={34} aria-hidden="true" />
            <Sparkles className="spark b" size={22} aria-hidden="true" />
            <div className="mascot-crop" role="img" aria-label="The HABLAR mascot smiling warmly" />
          </div>
          <div className="story-copy scroll-reveal">
            <span className="section-kicker">A little breathing room</span>
            <h2>Come as you are.<br />Speak as you feel.</h2>
            <p>You do not need the perfect words or a polished version of your story. Bring the messy middle, the tiny win, the thing you have been carrying around.</p>
            <p><strong>Someone is here to listen without labels, assumptions, or judgment.</strong> Not to hurry you toward an answer. Just to make sure you do not feel alone in the moment.</p>
            <div className="pill-row"><span className="pill">Your pace</span><span className="pill">Your words</span><span className="pill">No judgment</span></div>
          </div>
        </div>
      </section>

      <section className="section steps-section">
        <div className="section-heading scroll-reveal">
          <span className="section-kicker">No script required</span>
          <h2>There is no right way to show up.</h2>
          <p>Think of HABLAR as a pause in the noise: a place to say what is on your mind and be met with care.</p>
        </div>
        <div className="steps-list">
          <article className="step scroll-reveal"><span className="step-num">01 / ARRIVE</span><h3>Come as you are.</h3><p>There is no checklist, backstory, or “big enough” reason you need to bring.</p></article>
          <article className="step scroll-reveal"><span className="step-num">02 / SAY IT</span><h3>Speak as you feel.</h3><p>Take your time. Start anywhere. A pause is welcome too.</p></article>
          <article className="step scroll-reveal"><span className="step-num">03 / BE HEARD</span><h3>Let it land.</h3><p>Someone listens with care, without trying to turn your feelings into a label.</p></article>
        </div>
      </section>

      <section className="values-wrap" id="our-promise">
        <div className="section values-layout">
          <div className="values-big scroll-reveal">Listening is a kind of <span>care.</span></div>
          <div className="values-copy scroll-reveal">
            We believe people deserve a space where their words are not measured, ranked, or rushed. A good listener does not need to have lived your story to make room for it.
            <div className="value-points">
              <div className="value-point"><span className="value-mark"><Check size={16} /></span><span><strong>Curiosity over assumptions</strong><br />We meet your story as yours.</span></div>
              <div className="value-point"><span className="value-mark"><Check size={16} /></span><span><strong>Warmth over fixing</strong><br />Your feelings do not need a quick solution.</span></div>
              <div className="value-point"><span className="value-mark"><Check size={16} /></span><span><strong>Human, not clinical</strong><br />This is listening, not therapy or diagnosis.</span></div>
              <div className="value-point"><span className="value-mark"><Check size={16} /></span><span><strong>Room for every feeling</strong><br />There is no “too much” in being human.</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section quote-section">
        <div className="connection-card scroll-reveal">
          <img src="/brand/hablar-listening-moment.png" alt="Three people sharing a warm, supportive conversation" />
          <div className="connection-copy">
            <span className="section-kicker">A human moment</span>
            <h2>A little lighter, together.</h2>
            <p>Sometimes the nicest thing is having someone meet your words with care, share a smile, and stay awhile.</p>
          </div>
        </div>
      </section>

      <div className="boundary">
        <div className="boundary-inner">
          <div className="boundary-icon"><ShieldCheck size={18} aria-hidden="true" /></div>
          <p><strong>A clear, caring boundary:</strong> HABLAR is a human listening space, not professional mental-health care, therapy, diagnosis, or emergency support. If you are in immediate danger or need urgent help, contact your local emergency services or a trusted person nearby.</p>
        </div>
      </div>

      <Signup />
      <Footer />
    </main>
  );
}

const legalCopy = {
  privacy: {
    title: 'Privacy, with care.',
    intro: 'This is a draft privacy notice for review. The HABLAR service is not yet launched, and this page does not collect or transmit contact details.',
    sections: [
      ['What this prototype does', 'The launch form is a visual interaction only. When you preview it, the page checks the fields in your browser and then displays a notice. It does not send a request, store information, or save your details.'],
      ['Future service details need review', 'Before launch, HABLAR must document what information the service will handle, why it is needed, how long it is kept, who can access it, and how people can ask questions or exercise their choices. Those operational details are not established here.'],
      ['Choices and contact', 'The prototype consent checkbox demonstrates a possible opt-in for launch updates. No message is sent and no contact list is created in this preview.'],
      ['Questions and updates', 'This draft will need an appropriate contact channel and a clear effective date before publication.'],
    ],
  },
  terms: {
    title: 'A few things to know.',
    intro: 'This is draft terms content for review, not final service terms. It describes the intended spirit of HABLAR and is not a complete agreement.',
    sections: [
      ['What HABLAR is', 'HABLAR is intended to be a warm, anonymous listening space where people can speak freely and feel heard. The service is being developed; availability, features, and operating details may change.'],
      ['What HABLAR is not', 'HABLAR is not therapy, diagnosis, professional mental-health care, medical advice, or emergency support. Listeners are not a substitute for qualified professionals.'],
      ['Urgent support', 'If you or someone else may be in immediate danger, contact local emergency services or a trusted person who can help in person. Do not rely on HABLAR for urgent or crisis response.'],
      ['Before the service opens', 'Final terms should explain eligibility, service availability, account and privacy practices, safety processes, limitations, and a way to contact the service. Those details require review before publication.'],
    ],
  },
};

function LegalPage({ page }: { page: 'privacy' | 'terms' }) {
  const content = legalCopy[page];
  return (
    <main className="legal-page">
      <div className="legal-top"><Link href="/" className="brand-mini"><img src="/brand/hablar-logo-reference.jpeg" alt="HABLAR home" /></Link></div>
      <article className="legal-content">
        <span className="section-kicker">HABLAR / {page}</span>
        <h1>{content.title}</h1>
        <div className="draft-banner"><strong>Draft for review — not final legal text.</strong> This prototype does not claim legal compliance. The content needs review and completion before publication.</div>
        <p>{content.intro}</p>
        {content.sections.map(([heading, text]) => <section key={heading}><h2>{heading}</h2><p>{text}</p></section>)}
        <Link className="legal-back" href="/"><ArrowLeft size={16} /> Back to HABLAR</Link>
      </article>
      <Footer />
    </main>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/privacy"><LegalPage page="privacy" /></Route>
        <Route path="/terms"><LegalPage page="terms" /></Route>
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

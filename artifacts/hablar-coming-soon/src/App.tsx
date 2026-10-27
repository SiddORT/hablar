import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCreateWaitlistSignup } from '@workspace/api-client-react';
import { defaultCountries, parseCountry } from 'react-international-phone';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ArrowDown, ArrowLeft, ArrowUpRight, Check, ShieldCheck, Sparkles } from 'lucide-react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const phoneCountries = defaultCountries.map(parseCountry);
gsap.registerPlugin(ScrollTrigger);

function countryFlag(iso2: string) {
  return [...iso2.toUpperCase()]
    .map((letter) => String.fromCodePoint(letter.charCodeAt(0) + 127397))
    .join('');
}

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
      gsap.fromTo('.emotion-card', { opacity: 0, y: 18 }, {
        opacity: 1, y: 0, duration: .8, ease: 'power2.out',
        scrollTrigger: { trigger: '.emotion-circle', start: 'top 80%', once: true },
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
          <img src={`${import.meta.env.BASE_URL}brand/hablar-logo-transparent.png`} alt="HABLAR" />
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
  const [phone, setPhone] = useState('');
  const [phoneCountry, setPhoneCountry] = useState('in');
  const signup = useCreateWaitlistSignup();
  function submitSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get('email') || '').trim();
    const phoneNumber = phone.trim();
    const country = phoneCountries.find((item) => item.iso2 === phoneCountry);
    const consent = data.get('consent') === 'on';
    const termsAccepted = data.get('termsAccepted') === 'on';
    if (!email && !phoneNumber) {
      setStatus('Add an email address or phone number.');
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus('Please check the email address format.');
      return;
    }
    if (phoneNumber && !/^[\d\s().+-]+$/.test(phoneNumber)) {
      setStatus('Use numbers and phone formatting only.');
      return;
    }
    const phoneDigits = phoneNumber.replace(/\D/g, '');
    const normalizedPhone = phoneNumber
      ? phoneNumber.startsWith('+')
        ? `+${phoneDigits}`
        : `+${country?.dialCode || '91'}${phoneDigits}`
      : '';
    if (normalizedPhone && !/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) {
      setStatus('Add a country code, for example +91 98765 43210.');
      return;
    }
    if (!consent) {
      setStatus('Please consent to the one-time launch update.');
      return;
    }
    if (!termsAccepted) {
      setStatus('Please agree to the Terms & Conditions.');
      return;
    }
    setStatus('');
    signup.mutate(
      {
        data: {
          email: email || null,
          phone: normalizedPhone || null,
          consent,
          termsAccepted,
        },
      },
      {
        onSuccess: (response) => {
          setStatus(response.message);
          form.reset();
          setPhone('');
          setPhoneCountry('in');
        },
        onError: (error) => {
          setStatus(error.message || 'The sign-up could not be saved. Please try again.');
        },
      },
    );
  }
  return (
    <section className="signup-section" id="launch-note">
      <div className="signup-panel scroll-reveal">
        <div>
          <span className="section-kicker">A note when we open?</span>
          <h2>Let the good news find you.</h2>
          <p>Leave an email, a phone number, or both. Your contact details are encrypted before they are stored. Please review the draft policies before signing up.</p>
        </div>
        <form className="form-wrap" onSubmit={submitSignup} noValidate>
          <label className="form-label" htmlFor="email">Email address <span style={{ fontWeight: 400, color: '#888' }}>— optional</span></label>
          <input className="contact-input" id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" />
          <label className="form-label" htmlFor="phone">Phone number <span style={{ fontWeight: 400, color: '#888' }}>— optional</span></label>
          <div className="phone-entry-row">
            <select
              className="phone-country-select"
              aria-label="Country calling code"
              value={phoneCountry}
              onChange={(event) => setPhoneCountry(event.target.value)}
            >
              {phoneCountries.map((country) => (
                <option key={country.iso2} value={country.iso2}>
                  {countryFlag(country.iso2)} {country.name} (+{country.dialCode})
                </option>
              ))}
            </select>
            <input
              className="contact-input phone-local-input"
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel-national"
              placeholder="98765 43210"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>
          <label className="consent">
            <input type="checkbox" name="consent" required />
            <span>I consent to HABLAR processing my contact details solely to send one launch update, as described in the <Link href="/privacy" target="_blank" rel="noreferrer">Privacy Notice</Link>.</span>
          </label>
          <label className="consent">
            <input type="checkbox" name="termsAccepted" required />
            <span>I agree to the <Link href="/terms" target="_blank" rel="noreferrer">Terms &amp; Conditions</Link>.</span>
          </label>
          <button className="button-primary form-submit" type="submit" disabled={signup.isPending}>
            {signup.isPending ? 'Saving your place…' : 'Send me the first update'}
            <ArrowUpRight size={17} aria-hidden="true" />
          </button>
          <p className="prototype-note">Contact fields are encrypted in the database. This privacy notice and the terms are drafts for review.</p>
          <p className="form-status" role="status" aria-live="polite">{status}</p>
        </form>
      </div>
    </section>
  );
}

function Home() {
  usePageMotion();
  const emotions = [
    { label: 'Crying', position: '0% 0%', copy: 'If tears come, you do not have to hold them back.' },
    { label: 'Sad', position: '50% 0%', copy: 'You can bring the heavy days, too.' },
    { label: 'Unsure', position: '100% 0%', copy: 'You can begin without knowing exactly what you feel.' },
    { label: 'Happy', position: '0% 100%', copy: 'Your small wins and bright moments belong here.' },
    { label: 'Very happy', position: '50% 100%', copy: 'There is room for the big, joyful moments.' },
    { label: 'Feeling loved', position: '100% 100%', copy: 'Share the warmth when your heart feels full.' },
  ];
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

      <section className="section emotions-section" id="feelings" aria-labelledby="feelings-heading">
        <div className="emotion-circle">
          <div className="emotion-center scroll-reveal">
            <span className="section-kicker">Every feeling belongs</span>
            <h2 id="feelings-heading">Different feelings. Same welcome.</h2>
            <p>There is room here for tears, for joy, and for not being sure yet. HABLAR meets you with care, just as you are.</p>
          </div>
          <ul className="emotion-ring" role="list" aria-label="Six feelings welcomed at HABLAR">
            {emotions.map((emotion, index) => (
              <li className={`emotion-card slot-${index}`} key={emotion.label}>
                <div
                  className="emotion-art"
                  role="img"
                  aria-label={`${emotion.label} expression of the HABLAR mascot`}
                  style={{ backgroundPosition: emotion.position }}
                />
                <div className="emotion-card-copy">
                  <h3>{emotion.label}</h3>
                  <p>{emotion.copy}</p>
                </div>
              </li>
            ))}
          </ul>
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
    intro: 'This is a draft privacy notice for review. Submitting the launch form sends the contact details you choose to provide to HABLAR’s API.',
    sections: [
      ['What the launch form stores', 'The email address and/or phone number you submit is encrypted with AES-GCM before storage in PostgreSQL. A keyed, non-reversible lookup digest is used only to avoid duplicate contacts. HABLAR does not return or display stored contact details through this website.'],
      ['Purpose and consent', 'Contact details are used only to send one launch update. The form records the consent version, privacy-notice version, terms version, and server-side consent time. You must actively consent and accept the terms before submitting.'],
      ['Retention and your choices', 'The retention period, data-controller details, applicable jurisdiction, contact channel for access or deletion requests, and how to withdraw consent still need to be completed. This draft is not a complete GDPR notice and does not claim legal compliance.'],
      ['Before publication', 'HABLAR must confirm its legal entity and contact details, retention schedule, infrastructure processors and transfer details, and a practical process for privacy requests before collecting public sign-ups.'],
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
        <div className="draft-banner"><strong>Draft for review — not final legal text.</strong> This page does not claim legal compliance. The content needs review and completion before public sign-ups.</div>
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

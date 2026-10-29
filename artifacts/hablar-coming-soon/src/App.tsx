import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCreateWaitlistSignup } from '@workspace/api-client-react';
import { CountryPicker, phoneCountries } from '@/components/country-picker';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ArrowDown, ArrowUp, ArrowUpRight, Check, ShieldCheck } from 'lucide-react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import NotFound from '@/pages/not-found';
import LegalPage from '@/pages/legal';
import { usePageSeo } from '@/lib/use-page-seo';
import { AboutServices, PurposeMission, ClosingLine } from '@/components/landing-story';
import { ThemeProvider, ThemeSelector } from '@/components/theme-selector';
import { BrandLogo } from '@/components/brand-logo';

const queryClient = new QueryClient();
gsap.registerPlugin(ScrollTrigger);

const INSTAGRAM_PROFILE_URL = 'https://www.instagram.com/hablar.wetalk/';

function InstagramGradientIcon({ gradientId }: { gradientId: string }) {
  const gradientUrl = `url(#${gradientId})`;

  return (
    <svg
      className="instagram-gradient-icon"
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="3" y1="21" x2="21" y2="3" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FEDA75" />
          <stop offset=".32" stopColor="#FA7E1E" />
          <stop offset=".62" stopColor="#D62976" />
          <stop offset="1" stopColor="#4F5BD5" />
        </linearGradient>
      </defs>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.2" stroke={gradientUrl} strokeWidth="2" />
      <circle cx="12" cy="12" r="4.1" stroke={gradientUrl} strokeWidth="2" />
      <circle cx="17.7" cy="6.4" r="1.15" fill={gradientUrl} />
    </svg>
  );
}

type SignupFeedback =
  | { kind: 'success' | 'error'; message: string }
  | null;

function usePageMotion() {
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    const scroller = document.querySelector<HTMLElement>('.app-scrollport');
    const context = gsap.context(() => {
      gsap.fromTo('.hero-reveal', { opacity: 0, y: 22 }, {
        opacity: 1, y: 0, duration: .9, stagger: .13, ease: 'power3.out', delay: .12,
      });
      gsap.utils.toArray<HTMLElement>('.scroll-reveal, .hr-reveal').forEach((element) => {
        gsap.fromTo(element, { y: 22 }, {
          y: 0, duration: .68, ease: 'power2.out',
          scrollTrigger: { trigger: element, scroller: scroller ?? undefined, start: 'top 88%', once: true },
        });
      });
    });
    return () => context.revert();
  }, []);
}

function Header() {
  return (
    <header className="topbar">
      <Link href="/" className="brand-mini" aria-label="HABLAR home">
        <BrandLogo
          src={`${import.meta.env.BASE_URL}brand/hablar-logo-transparent.png`}
          alt="HABLAR — Your safe space to express"
        />
      </Link>
      <nav className="nav-links" aria-label="Main navigation">
        <a className="nav-plain" href="#about" data-testid="link-about">About HABLAR</a>
        <a className="nav-plain" href="#how-it-works">Our services</a>
        <a className="nav-plain" href="#our-promise">Our mission</a>
        <ThemeSelector />
        <a className="nav-cta" href="#launch-note">Interested. Let's Talk</a>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <BrandLogo
            className="brand-logo--footer"
            src={`${import.meta.env.BASE_URL}brand/hablar-logo-transparent.png`}
            alt="HABLAR"
          />
          <p>A little more room to be human. Come as you are.</p>
        </div>
        <nav className="footer-links" aria-label="Footer navigation">
          <a href={`${import.meta.env.BASE_URL}#how-it-works`}>How it feels</a>
          <Link href="/privacy">Privacy Notice</Link>
          <Link href="/terms">Terms &amp; Conditions</Link>
        </nav>
      </div>
      <p className="footer-note">HABLAR is a listening space, not therapy, diagnosis, professional mental-health care, or emergency support. If you may be in immediate danger, contact local emergency services or a trusted person nearby.</p>
      <p className="footer-copyright">Copyright © 2026 HABLAR</p>
    </footer>
  );
}

function Signup() {
  const [feedback, setFeedback] = useState<SignupFeedback>(null);
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
      setFeedback({ kind: 'error', message: 'Add an email address or phone number.' });
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFeedback({ kind: 'error', message: 'Please check the email address format.' });
      return;
    }
    if (phoneNumber && !/^[\d\s().+-]+$/.test(phoneNumber)) {
      setFeedback({ kind: 'error', message: 'Use numbers and phone formatting only.' });
      return;
    }
    const phoneDigits = phoneNumber.replace(/\D/g, '');
    const normalizedPhone = phoneNumber
      ? phoneNumber.startsWith('+')
        ? `+${phoneDigits}`
        : `+${country?.dialCode || '91'}${phoneDigits}`
      : '';
    if (normalizedPhone && !/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) {
      setFeedback({
        kind: 'error',
        message: 'Add a country code, for example +91 98765 43210.',
      });
      return;
    }
    if (!consent) {
      setFeedback({ kind: 'error', message: 'Please consent to the one-time launch update.' });
      return;
    }
    if (!termsAccepted) {
      setFeedback({ kind: 'error', message: 'Please agree to the Terms & Conditions.' });
      return;
    }
    setFeedback(null);
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
          setFeedback({ kind: 'success', message: response.message });
          form.reset();
          setPhone('');
          setPhoneCountry('in');
        },
        onError: (error) => {
          setFeedback({
            kind: 'error',
            message: error.message || 'The sign-up could not be saved. Please try again.',
          });
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
            <CountryPicker value={phoneCountry} onChange={setPhoneCountry} />
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
            <span>I consent to HABLAR processing my contact details to send one signup confirmation by email when I provide an email address, send one launch update, and notify the HABLAR administrator about my signup, as described in the <Link href="/privacy" target="_blank" rel="noreferrer">Privacy Notice</Link>.</span>
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
          {feedback?.kind === 'success' && (
            <div className="form-status form-status--success" role="status" aria-live="polite" aria-atomic="true">
              <span className="form-status-icon" aria-hidden="true"><Check size={17} /></span>
              <span className="form-status-copy">
                <strong>{feedback.message.split('\n\n', 2)[0]}</strong>
                <span>{feedback.message.split('\n\n', 2)[1]}</span>
              </span>
            </div>
          )}
          {feedback?.kind === 'error' && (
            <p className="form-status form-status--error" role="alert">{feedback.message}</p>
          )}
        </form>
      </div>
    </section>
  );
}

function Home() {
  usePageMotion();
  useEffect(() => {
    const targetId = window.location.hash.slice(1);
    if (!targetId) return;
    requestAnimationFrame(() => {
      document.getElementById(decodeURIComponent(targetId))?.scrollIntoView({ behavior: 'instant' });
    });
  }, []);
  const emotions = [
    { label: 'Crying', position: '0% 0%', copy: 'If tears come, you do not have to hold them back.' },
    { label: 'Sad', position: '50% 0%', copy: 'You can bring the heavy days, too.' },
    { label: 'Unsure', position: '100% 0%', copy: 'You can begin without knowing exactly what you feel.' },
    { label: 'Happy', position: '0% 100%', copy: 'Your small wins and bright moments belong here.' },
    { label: 'Very happy', position: '50% 100%', copy: 'There is room for the big, joyful moments.' },
    { label: 'Feeling loved', position: '100% 100%', copy: 'Share the warmth when your heart feels full.' },
  ];
  return (
    <main className="site-shell" tabIndex={-1}>
      <Header />
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-copy">
            <div className="hero-intro hero-reveal">
              <span className="launch-status">Coming soon</span>
            </div>
            <h1 className="hero-reveal">Your safe space <span>to express</span></h1>
            <p className="hero-lede hero-reveal">Because every story deserves a space, every person deserves to be heard, and sometimes, one heartfelt conversation can make a difference.</p>
            <div className="hero-details hero-reveal">
              <ul className="hero-commitments" aria-label="Future service intentions">
                <li>Your identity would remain anonymous to the person you connect with.</li>
                <li>Youreplar first interaction would take place on HABLAR.</li>
              </ul>
              <div className="hero-actions">
                <a className="button-primary" href="#launch-note" data-testid="link-hero-preregister">
                  Pre-register
                  <ArrowUpRight size={17} aria-hidden="true" />
                </a>
                <a
                  className="hero-instagram-cta"
                  href={INSTAGRAM_PROFILE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Follow us on Instagram (opens in a new tab)"
                  data-testid="link-hero-instagram"
                >
                  <InstagramGradientIcon gradientId="instagram-icon-gradient-hero" />
                  <span>Follow us on Instagram</span>
                </a>
              </div>
            </div>
          </div>
          <div className="hero-art hero-reveal">
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
              src={`${import.meta.env.BASE_URL}brand/hablar-connection-silhouettes.png`}
              alt=""
              aria-hidden="true"
            />
            <ul className="hero-topic-list" aria-label="Topics you may want to talk about">
              {[
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
              ].map((topic) => (
                <li className="hero-topic-item" key={topic}>
                  <span className="hero-topic-hash" aria-hidden="true">#</span>
                  <span>{topic}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      <section className="story-band" id="how-it-works">
        <div className="story-inner">
          <p className="story-message scroll-reveal">
            HABLAR is a safe space for you. A reminder that you're never truly alone.
          </p>
        </div>
      </section>
      <PurposeMission />
      <AboutServices />
      <section className="section emotions-section" id="feelings" aria-labelledby="feelings-heading">
        <div className="emotion-circle">
          <div className="emotion-center">
            <div className="emotion-center-copy scroll-reveal">
              <span className="section-kicker">Every feeling belongs</span>
              <h2 id="feelings-heading">Different feelings. Same welcome.</h2>
              <p>There is room here for tears, for joy, and for not being sure yet. HABLAR meets you with care, just as you are.</p>
            </div>
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
          <h2 className="values-big scroll-reveal">Listening is a kind of <span>care.</span></h2>
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
      <section className="section quote-section" id="connection" aria-labelledby="connection-heading">
        <div className="connection-card scroll-reveal">
          <img
            src={`${import.meta.env.BASE_URL}brand/hablar-indian-table-talk.webp`}
            alt="A woman and man looking at each other in conversation across a table with a notebook and laptop"
            width={1400}
            height={933}
            loading="lazy"
            decoding="async"
          />
          <div className="connection-copy">
            <span className="section-kicker">A human moment</span>
            <h2 id="connection-heading">A little lighter, together.</h2>
            <p>Sometimes the nicest thing is having someone meet your words with care, share a smile, and stay awhile.</p>
            <div className="connection-actions">
              <p className="connection-launch-note">HABLAR is coming soon. Sign up for a launch update.</p>
              <a className="button-primary connection-cta" href="#launch-note">
                Interested. Let's Talk <ArrowDown size={16} aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </section>
      <div className="boundary">
        <div className="boundary-inner">
          <div className="boundary-icon"><ShieldCheck size={18} aria-hidden="true" /></div>
          <p><strong>A clear, caring boundary:</strong> HABLAR is a human listening space, not professional mental-health care, therapy, diagnosis, or emergency support. If you are in immediate danger or need urgent help, contact your local emergency services or a trusted person nearby.</p>
        </div>
      </div>
      <ClosingLine />
      <Signup />
      <Footer />
    </main>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Router() {
  const [location] = useLocation();
  const [showLaunchCta, setShowLaunchCta] = useState(true);
  const [showInstagramCta, setShowInstagramCta] = useState(true);
  const [showHeroDock, setShowHeroDock] = useState(true);
  const [showReturnToTop, setShowReturnToTop] = useState(false);
  const isLegalPage = location === '/privacy' || location === '/terms';
  usePageSeo(location);
  useEffect(() => {
    const scrollport = document.querySelector<HTMLElement>('.app-scrollport');
    if (!scrollport) return;

    const updateVisibility = () => setShowReturnToTop(scrollport.scrollTop > 240);
    updateVisibility();
    scrollport.addEventListener('scroll', updateVisibility, { passive: true });
    return () => scrollport.removeEventListener('scroll', updateVisibility);
  }, [location]);
  useEffect(() => {
    const signupSection = document.getElementById('launch-note');
    const scrollport = document.querySelector<HTMLElement>('.app-scrollport');

    if (isLegalPage && scrollport) {
      let frame = 0;
      const updateVisibility = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          const cta = document.querySelector<HTMLElement>('.launch-sticky-cta');
          const instagramCta = document.querySelector<HTMLElement>('.instagram-sticky-cta');
          if (!cta || !instagramCta) return;
          if (document.activeElement === cta || document.activeElement === instagramCta) return;
          const dockRect = document.querySelector<HTMLElement>('.launch-sticky-dock')?.getBoundingClientRect();
          if (!dockRect) return;
          const legalText = document.querySelectorAll<HTMLElement>(
            '#legal-main h1, #legal-main h2, #legal-main p, #legal-main li, #legal-main a',
          );
          const overlapsText = Array.from(legalText).some((element) => {
            const rect = element.getBoundingClientRect();
            return rect.left < dockRect.right
              && rect.right > dockRect.left
              && rect.top < dockRect.bottom
              && rect.bottom > dockRect.top;
          });
          setShowLaunchCta(!overlapsText);
          setShowInstagramCta(!overlapsText);
        });
      };

      updateVisibility();
      const cta = document.querySelector<HTMLElement>('.launch-sticky-cta');
      const instagramCta = document.querySelector<HTMLElement>('.instagram-sticky-cta');
      cta?.addEventListener('blur', updateVisibility);
      instagramCta?.addEventListener('blur', updateVisibility);
      scrollport.addEventListener('scroll', updateVisibility, { passive: true });
      window.addEventListener('resize', updateVisibility);
      return () => {
        cancelAnimationFrame(frame);
        cta?.removeEventListener('blur', updateVisibility);
        instagramCta?.removeEventListener('blur', updateVisibility);
        scrollport.removeEventListener('scroll', updateVisibility);
        window.removeEventListener('resize', updateVisibility);
      };
    }

    if (location !== '/' || !signupSection || !scrollport) {
      setShowLaunchCta(true);
      setShowInstagramCta(true);
      return;
    }

    let frame = 0;
    const updateInstagramVisibility = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const instagramCta = document.querySelector<HTMLElement>('.instagram-sticky-cta');
        const dock = document.querySelector<HTMLElement>('.launch-sticky-dock');
        if (!instagramCta || !dock || dock.contains(document.activeElement)) return;
        const topicList = document.querySelector<HTMLElement>('.hero-topic-list');
        if (topicList) {
          const dockRect = dock.getBoundingClientRect();
          const topicsRect = topicList.getBoundingClientRect();
          const overlapsTopics = topicsRect.left < dockRect.right
            && topicsRect.right > dockRect.left
            && topicsRect.top < dockRect.bottom
            && topicsRect.bottom > dockRect.top;
          setShowHeroDock(!overlapsTopics);
        } else {
          setShowHeroDock(true);
        }
        const ctaRect = instagramCta.getBoundingClientRect();
        const signupContent = document.querySelectorAll<HTMLElement>(
          '#launch-note h2, #launch-note p, #launch-note label, #launch-note input, #launch-note button',
        );
        const overlapsContent = Array.from(signupContent).some((element) => {
          if (element.tagName === 'P' && !element.textContent?.trim()) return false;
          const rect = element.getBoundingClientRect();
          return rect.left < ctaRect.right
            && rect.right > ctaRect.left
            && rect.top < ctaRect.bottom
            && rect.bottom > ctaRect.top;
        });
        setShowInstagramCta(!overlapsContent);
      });
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowLaunchCta(!entry.isIntersecting);
        updateInstagramVisibility();
      },
      { root: scrollport, threshold: 0.01 },
    );
    observer.observe(signupSection);
    scrollport.addEventListener('scroll', updateInstagramVisibility, { passive: true });
    window.addEventListener('resize', updateInstagramVisibility);
    const dockLinks = document.querySelectorAll<HTMLElement>(
      '.launch-sticky-cta, .instagram-sticky-cta',
    );
    dockLinks.forEach((link) => link.addEventListener('blur', updateInstagramVisibility));
    updateInstagramVisibility();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      scrollport.removeEventListener('scroll', updateInstagramVisibility);
      window.removeEventListener('resize', updateInstagramVisibility);
      dockLinks.forEach((link) => link.removeEventListener('blur', updateInstagramVisibility));
    };
  }, [location]);
  return (
    <RoutedErrorBoundary>
      <>
        <div className="app-scrollport">
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/privacy"><LegalPage page="privacy" footer={<Footer />} /></Route>
            <Route path="/terms"><LegalPage page="terms" footer={<Footer />} /></Route>
            <Route component={NotFound} />
          </Switch>
        </div>
        <div
          className={`launch-sticky-dock${showLaunchCta ? '' : ' is-launch-hidden'}${showInstagramCta ? '' : ' is-follow-obscured'}${showHeroDock || location !== '/' ? '' : ' is-hero-art-obscured'}${isLegalPage ? ' is-legal-page' : ''}`}
        >
          <a
            className="instagram-sticky-cta"
            href={INSTAGRAM_PROFILE_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Follow us on Instagram (opens in a new tab)"
            tabIndex={showInstagramCta && (showHeroDock || location !== '/') ? 0 : -1}
            data-testid="link-instagram"
          >
            <InstagramGradientIcon gradientId="instagram-icon-gradient-sticky" />
            <span>Follow us on Instagram</span>
          </a>
          <a
            className="launch-sticky-cta"
            href={`${import.meta.env.BASE_URL}#launch-note`}
            aria-label="Interested. Let's Talk"
            tabIndex={showLaunchCta && (showHeroDock || location !== '/') ? 0 : -1}
          >
            Interested. Let's Talk
            <ArrowUpRight size={17} aria-hidden="true" />
          </a>
        </div>
        <button
          className="return-top-button"
          type="button"
          aria-label="Return to top"
          title="Return to top"
          hidden={!showReturnToTop}
          onClick={() => {
            const scrollport = document.querySelector<HTMLElement>('.app-scrollport');
            if (!scrollport) return;
            const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            scrollport.scrollTo({ top: 0, behavior: reducedMotion ? 'instant' : 'smooth' });
            document.querySelector<HTMLElement>('.site-shell, #legal-main')?.focus({ preventScroll: true });
          }}
        >
          <ArrowUp size={19} aria-hidden="true" />
        </button>
      </>
    </RoutedErrorBoundary>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
        </ThemeProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

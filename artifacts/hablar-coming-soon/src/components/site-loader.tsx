import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';

const REVEAL_DURATION_MS = 1_050;
const FAILURE_FALLBACK_MS = 1_800;
const EXIT_DURATION_MS = 220;

export function SiteLoader() {
  const [isVisible, setIsVisible] = useState(true);
  const [isLogoReady, setIsLogoReady] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const hasStartedReveal = useRef(false);
  const hasStartedExit = useRef(false);
  const fallbackTimer = useRef<number | undefined>(undefined);
  const revealTimer = useRef<number | undefined>(undefined);
  const exitTimer = useRef<number | undefined>(undefined);

  const logoSrc = `${import.meta.env.BASE_URL}brand/hablar-logo-transparent.png`;
  const logoMaskStyle = {
    '--loader-logo-mask': `url("${logoSrc}")`,
  } as CSSProperties;

  const dismiss = useCallback(() => {
    if (hasStartedExit.current) return;
    hasStartedExit.current = true;
    setIsLeaving(true);
    exitTimer.current = window.setTimeout(() => setIsVisible(false), EXIT_DURATION_MS);
  }, []);

  const handleLogoLoad = useCallback(() => {
    if (hasStartedReveal.current || hasStartedExit.current) return;
    hasStartedReveal.current = true;
    if (fallbackTimer.current !== undefined) window.clearTimeout(fallbackTimer.current);
    setIsLogoReady(true);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    revealTimer.current = window.setTimeout(
      dismiss,
      reducedMotion ? 60 : REVEAL_DURATION_MS,
    );
  }, [dismiss]);

  useEffect(() => {
    fallbackTimer.current = window.setTimeout(dismiss, FAILURE_FALLBACK_MS);

    // If a keyboard user reaches the page while the decorative reveal is running,
    // remove it immediately instead of leaving the focused control visually covered.
    document.addEventListener('focusin', dismiss);

    return () => {
      document.removeEventListener('focusin', dismiss);
      if (fallbackTimer.current !== undefined) window.clearTimeout(fallbackTimer.current);
      if (revealTimer.current !== undefined) window.clearTimeout(revealTimer.current);
      if (exitTimer.current !== undefined) window.clearTimeout(exitTimer.current);
    };
  }, [dismiss]);

  if (!isVisible) return null;

  return (
    <div
      className={`site-loader${isLeaving ? ' site-loader--leaving' : ''}`}
      aria-hidden="true"
      data-testid="site-loader"
    >
      <div className={`site-loader__content${isLogoReady ? ' site-loader__content--ready' : ''}`}>
        <div className="site-loader__mark" style={logoMaskStyle}>
          <img src={logoSrc} alt="" onLoad={handleLogoLoad} onError={dismiss} />
          <span className="site-loader__sweep" style={logoMaskStyle} />
        </div>
      </div>
    </div>
  );
}

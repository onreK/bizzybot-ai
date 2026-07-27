'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Fades and lifts its children into place the first time they scroll into view.
 *
 * FAILS VISIBLE, DELIBERATELY. Content is NOT hidden in the server-rendered
 * HTML — the hidden state is only applied once this component has mounted and
 * confirmed the browser can animate. If JavaScript fails, is disabled, or a
 * crawler doesn't execute it, the page is simply the static page it was before.
 * BizzyBot lost seven weeks of Google indexing to content Google couldn't see;
 * motion is not worth re-introducing that class of risk.
 *
 * Honours prefers-reduced-motion: those visitors get the static page too.
 */
export default function Reveal({ children, delay = 0, className = '' }) {
  const ref = useRef(null);
  const [animating, setAnimating] = useState(false); // JS confirmed, safe to hide
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // No IntersectionObserver (old browser) or motion turned down — leave the
    // content exactly as rendered and never touch it.
    if (reducedMotion || typeof IntersectionObserver === 'undefined') return;

    setAnimating(true);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShown(true);
        observer.disconnect(); // reveal once; re-animating on scroll-back reads cheap
      },
      // Fire slightly before the section reaches the viewport edge so the
      // motion finishes as it arrives rather than starting late.
      { threshold: 0.1, rootMargin: '0px 0px -60px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const hidden = animating && !shown;
  // The delay must persist through the reveal, not only while hidden — it is
  // the transition INTO view that staggers, so it has to still be set then.
  const style = animating && delay ? { transitionDelay: `${delay}ms` } : undefined;

  return (
    <div
      ref={ref}
      className={`${className} ${
        animating ? 'transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none' : ''
      } ${hidden ? 'opacity-0 translate-y-3' : 'opacity-100 translate-y-0'}`}
      style={style}
    >
      {children}
    </div>
  );
}

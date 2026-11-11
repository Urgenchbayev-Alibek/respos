import { useEffect, useRef } from 'react';

/**
 * One-shot scroll reveal for explanatory blocks. The element is hidden only after JS confirms it
 * can be revealed (observer available, motion allowed, element still below the fold), so no-JS,
 * print, reduced motion and tests see the page unchanged. Styling lives in CSS (`[data-reveal]`).
 */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') return undefined;
    if (typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    if (element.getBoundingClientRect().top < window.innerHeight) return undefined;

    element.dataset.reveal = 'pending';
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        element.dataset.reveal = 'in';
        observer.disconnect();
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.15 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      delete element.dataset.reveal;
    };
  }, []);

  return ref;
}

import { useEffect } from 'react';

export const SITE_NAME = 'RestaurantOS';

const setMeta = (attr: 'name' | 'property', key: string, value: string): void => {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
};

/** Sets document title, meta description and OG title/description for the current page. */
export function usePageMeta(title: string, description: string): void {
  useEffect(() => {
    const fullTitle = title === SITE_NAME ? title : `${title} — ${SITE_NAME}`;
    document.title = fullTitle;
    setMeta('name', 'description', description);
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', description);
  }, [title, description]);
}

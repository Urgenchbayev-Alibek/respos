export const ROUTES = {
  home: '/',
  features: '/features',
  pricing: '/pricing',
  faq: '/faq',
  contacts: '/contacts',
  demo: '/demo',
  booking: '/booking',
  privacy: '/privacy',
  terms: '/terms',
  /** Public QR menu of a branch (`?table=N` enables call-waiter buttons). */
  menu: '/menu/:branchSlug',
} as const;

/** Primary navigation (labels are i18n keys under `nav.*`). */
export const NAV_ITEMS = [
  { to: ROUTES.features, key: 'features' },
  { to: ROUTES.pricing, key: 'pricing' },
  { to: ROUTES.faq, key: 'faq' },
  { to: ROUTES.booking, key: 'booking' },
  { to: ROUTES.contacts, key: 'contacts' },
] as const;

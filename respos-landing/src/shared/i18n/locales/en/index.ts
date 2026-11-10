/**
 * English placeholder: only navigation is translated for now.
 * Missing keys fall back to Russian (see i18n `fallbackLng`).
 * Not offered in the language switch until fully translated.
 */
export const en = {
  nav: {
    home: 'Home',
    features: 'Features',
    pricing: 'Pricing',
    faq: 'FAQ',
    contacts: 'Contacts',
    demo: 'Request a demo',
    booking: 'Book a table',
    login: 'Sign in',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    skipToContent: 'Skip to content',
    primary: 'Main navigation',
    language: 'Site language',
  },
  qrMenu: {
    title: 'Menu',
    metaDescription: 'Restaurant menu: dishes, prices and photos.',
    loading: 'Loading the menu…',
    search: 'Search dishes',
    categories: 'Categories',
    table: 'Table {{number}}',
    nothingFound: 'Nothing found',
    empty: 'The menu is empty for now',
    fromPrice: 'from {{price}}',
    demo: 'Demo menu',
    notFound: {
      title: 'Menu not found',
      text: 'Check the link or QR code: the restaurant may have changed its menu address.',
    },
    error: { title: 'Could not load the menu', text: 'Check your connection and try again.', retry: 'Retry' },
    call: {
      waiter: 'Call a waiter',
      bill: 'Ask for the bill',
      sentWaiter: 'A waiter is on the way',
      sentBill: 'The bill is on its way',
      tooMany: 'Your call has already been sent. Please wait a minute.',
      tableNotFound: 'Table not found: please tell the staff.',
      failed: 'Could not send the call. Please try again.',
    },
  },
};

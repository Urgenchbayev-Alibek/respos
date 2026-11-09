import { common } from './common';
import { demo } from './demo';
import { faq } from './faq';
import { features } from './features';
import { home } from './home';
import { contacts, legal } from './pages';
import { pricing } from './pricing';

export const ru = { ...common, home, features, pricing, faq, demo, contacts, legal };

export type TranslationShape = typeof ru;

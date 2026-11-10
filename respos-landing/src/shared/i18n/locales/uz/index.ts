import type { Messages } from '../../types';
import type { TranslationShape } from '../ru';
import { common } from './common';
import { booking } from './booking';
import { demo } from './demo';
import { faq } from './faq';
import { features } from './features';
import { home } from './home';
import { contacts, legal } from './pages';
import { pricing } from './pricing';
import { qrMenu } from './qrMenu';

export const uz: Messages<TranslationShape> = {
  ...common,
  home,
  features,
  pricing,
  faq,
  demo,
  booking,
  contacts,
  legal,
  qrMenu,
};

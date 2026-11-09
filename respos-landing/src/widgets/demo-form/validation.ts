import { isValidUzPhone } from '@/shared/lib/phone';

export interface DemoFormValues {
  name: string;
  phone: string;
  email: string;
  restaurantName: string;
  city: string;
  message: string;
  /** Honeypot (hidden from humans). */
  website: string;
}

export type DemoField = Exclude<keyof DemoFormValues, 'website'>;

export const DEMO_FIELDS: readonly DemoField[] = ['name', 'phone', 'email', 'restaurantName', 'city', 'message'];

/** Client errors are i18n keys (re-translated on language change); server errors are ready text. */
export type FieldError = { key: string; params?: Record<string, number> } | { text: string };
export type FieldErrors = Partial<Record<DemoField, FieldError>>;

export const LIMITS = {
  name: { min: 2, max: 100 },
  restaurantName: { max: 150 },
  city: { max: 100 },
  email: { max: 254 },
  message: { max: 1000 },
} as const;

export const EMPTY_VALUES: DemoFormValues = {
  name: '',
  phone: '',
  email: '',
  restaurantName: '',
  city: '',
  message: '',
  website: '',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const tooLong = (max: number): FieldError => ({ key: 'demo.errors.tooLong', params: { max } });

export function validateDemoForm(values: DemoFormValues): FieldErrors {
  const errors: FieldErrors = {};
  const name = values.name.trim();
  const restaurant = values.restaurantName.trim();
  const email = values.email.trim();

  if (!name) errors.name = { key: 'demo.errors.required' };
  else if (name.length < LIMITS.name.min || name.length > LIMITS.name.max) errors.name = { key: 'demo.errors.nameLength' };

  if (!values.phone.trim()) errors.phone = { key: 'demo.errors.required' };
  else if (!isValidUzPhone(values.phone)) errors.phone = { key: 'demo.errors.phone' };

  if (email.length > LIMITS.email.max) errors.email = tooLong(LIMITS.email.max);
  else if (email && !EMAIL_RE.test(email)) errors.email = { key: 'demo.errors.email' };

  if (!restaurant) errors.restaurantName = { key: 'demo.errors.required' };
  else if (restaurant.length > LIMITS.restaurantName.max) errors.restaurantName = tooLong(LIMITS.restaurantName.max);

  if (values.city.trim().length > LIMITS.city.max) errors.city = tooLong(LIMITS.city.max);
  if (values.message.trim().length > LIMITS.message.max) errors.message = tooLong(LIMITS.message.max);

  return errors;
}

/** Maps ProblemDetails `errors` (camelCase or PascalCase keys) onto form fields. */
export function mapServerErrors(serverErrors: Record<string, string[]> | undefined): FieldErrors {
  const result: FieldErrors = {};
  if (!serverErrors) return result;
  for (const [rawKey, messages] of Object.entries(serverErrors)) {
    const key = rawKey.charAt(0).toLowerCase() + rawKey.slice(1);
    const field = DEMO_FIELDS.find((f) => f === key);
    const first = messages[0];
    if (field && first) result[field] = { text: first };
  }
  return result;
}

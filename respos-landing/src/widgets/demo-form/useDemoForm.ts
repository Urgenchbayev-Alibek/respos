import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, NetworkError } from '@/shared/api/client';
import { submitDemoRequest, type DemoRequestPayload } from '@/shared/api/publicApi';
import { formatUzPhone, toE164 } from '@/shared/lib/phone';
import {
  EMPTY_VALUES,
  mapServerErrors,
  validateDemoForm,
  type DemoField,
  type DemoFormValues,
  type FieldErrors,
} from './validation';

export type SubmitStatus = 'idle' | 'submitting' | 'success';

/** i18n key of the form-level error, if any. */
export type FormErrorKey =
  | 'demo.errors.summary'
  | 'demo.errors.rateLimited'
  | 'demo.errors.network'
  | 'demo.errors.server';

const optional = (value: string): string | undefined => value.trim() || undefined;

const toPayload = (values: DemoFormValues): DemoRequestPayload => ({
  name: values.name.trim(),
  phone: toE164(values.phone),
  email: optional(values.email),
  restaurantName: values.restaurantName.trim(),
  city: optional(values.city),
  message: optional(values.message),
  website: values.website,
});

const errorKeyFor = (error: unknown): FormErrorKey => {
  if (error instanceof ApiError) {
    if (error.status === 429) return 'demo.errors.rateLimited';
    if (error.status === 400 || error.status === 422) return 'demo.errors.summary';
    return 'demo.errors.server';
  }
  if (error instanceof NetworkError) return 'demo.errors.network';
  return 'demo.errors.server';
};

export function useDemoForm() {
  const { i18n } = useTranslation();
  const [values, setValues] = useState<DemoFormValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<FormErrorKey | null>(null);
  const [status, setStatus] = useState<SubmitStatus>('idle');
  /** Incremented after a failed validation so the view can move focus to the first invalid field. */
  const [invalidAttempt, setInvalidAttempt] = useState(0);

  const onChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const field = event.target.name as keyof DemoFormValues;
    const raw = event.target.value;
    const value = field === 'phone' ? formatUzPhone(raw) : raw;
    setValues((prev) => ({ ...prev, [field]: value }));
    if (field !== 'website' && errors[field as DemoField]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === 'submitting') return;

    const clientErrors = validateDemoForm(values);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) {
      setFormError('demo.errors.summary');
      setInvalidAttempt((n) => n + 1);
      return;
    }

    setFormError(null);
    // Bots that fill the honeypot get a fake success and nothing is sent.
    if (values.website) {
      setStatus('success');
      return;
    }

    setStatus('submitting');
    try {
      await submitDemoRequest(toPayload(values), i18n.resolvedLanguage);
      setStatus('success');
    } catch (error) {
      setStatus('idle');
      setFormError(errorKeyFor(error));
      if (error instanceof ApiError) {
        const serverErrors = mapServerErrors(error.problem?.errors);
        if (Object.keys(serverErrors).length > 0) {
          setErrors(serverErrors);
          setInvalidAttempt((n) => n + 1);
        }
      }
    }
  };

  const reset = () => {
    setValues(EMPTY_VALUES);
    setErrors({});
    setFormError(null);
    setStatus('idle');
  };

  return { values, errors, formError, status, invalidAttempt, onChange, onSubmit, reset };
}

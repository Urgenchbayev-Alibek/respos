import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, NetworkError } from '@/shared/api/client';
import {
  createPublicReservation,
  fetchAvailability,
  type PublicAvailability,
  type PublicReservationCreated,
} from '@/shared/api/publicApi';
import { formatUzPhone, isValidUzPhone, toE164 } from '@/shared/lib/phone';

export interface BookingValues {
  date: string;
  guests: string;
  time: string;
  name: string;
  phone: string;
  comment: string;
  website: string;
}

export type BookingField = 'date' | 'guests' | 'time' | 'name' | 'phone' | 'comment';
export type BookingErrors = Partial<Record<BookingField, { key: string; params?: Record<string, number> }>>;
export type BookingFormError =
  | 'booking.errors.summary'
  | 'booking.errors.slotTaken'
  | 'booking.errors.rateLimited'
  | 'booking.errors.network'
  | 'booking.errors.server';

export const COMMENT_MAX = 1000;

/** Local calendar date (YYYY-MM-DD) of the visitor; the server validates against the branch timezone. */
export const todayIso = (now = new Date()): string =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

const emptyValues = (): BookingValues => ({ date: todayIso(), guests: '2', time: '', name: '', phone: '', comment: '', website: '' });

export function validateBooking(values: BookingValues): BookingErrors {
  const errors: BookingErrors = {};
  const name = values.name.trim();
  if (!values.date) errors.date = { key: 'booking.errors.required' };
  if (!values.time) errors.time = { key: 'booking.errors.time' };
  if (!name) errors.name = { key: 'booking.errors.required' };
  else if (name.length < 2 || name.length > 100) errors.name = { key: 'booking.errors.nameLength' };
  if (!values.phone.trim()) errors.phone = { key: 'booking.errors.required' };
  else if (!isValidUzPhone(values.phone)) errors.phone = { key: 'booking.errors.phone' };
  if (values.comment.length > COMMENT_MAX) errors.comment = { key: 'booking.errors.tooLong', params: { max: COMMENT_MAX } };
  return errors;
}

const errorKeyFor = (error: unknown): BookingFormError => {
  if (error instanceof ApiError) {
    if (error.problem?.code === 'reservation.slot_unavailable') return 'booking.errors.slotTaken';
    if (error.status === 429) return 'booking.errors.rateLimited';
    if (error.status === 400 || error.status === 422) return 'booking.errors.summary';
    return 'booking.errors.server';
  }
  return error instanceof NetworkError ? 'booking.errors.network' : 'booking.errors.server';
};

export function useBooking(branchSlug: string) {
  const { i18n } = useTranslation();
  const [values, setValues] = useState<BookingValues>(emptyValues);
  const [errors, setErrors] = useState<BookingErrors>({});
  const [formError, setFormError] = useState<BookingFormError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<PublicReservationCreated | null>(null);
  const [reload, setReload] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; data: PublicAvailability | null }>({ key: '', data: null });
  const requestKey = `${values.date}|${values.guests}|${reload}`;
  // Derived: a result for another date/guests/reload is stale → still loading.
  const availabilityState: 'loading' | 'ready' | 'error' =
    !values.date ? 'ready' : loaded.key !== requestKey ? 'loading' : loaded.data ? 'ready' : 'error';
  const availability = loaded.key === requestKey ? loaded.data : null;

  useEffect(() => {
    if (!values.date) return undefined;
    const controller = new AbortController();
    fetchAvailability(branchSlug, values.date, Number(values.guests), controller.signal)
      .then((result) => setLoaded({ key: requestKey, data: result }))
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        setLoaded({ key: requestKey, data: null });
      });
    return () => controller.abort();
  }, [branchSlug, values.date, values.guests, requestKey]);

  const set = (field: keyof BookingValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value, ...(field === 'date' || field === 'guests' ? { time: '' } : {}) }));
    if (field !== 'website' && errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const onChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const field = event.target.name as keyof BookingValues;
    set(field, field === 'phone' ? formatUzPhone(event.target.value) : event.target.value);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const clientErrors = validateBooking(values);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) {
      setFormError('booking.errors.summary');
      return;
    }

    setFormError(null);
    setSubmitting(true);
    try {
      const result = await createPublicReservation(branchSlug, {
        date: values.date,
        time: values.time,
        guests: Number(values.guests),
        name: values.name.trim(),
        phone: toE164(values.phone),
        comment: values.comment.trim() || undefined,
        website: values.website,
      }, i18n.resolvedLanguage);
      setCreated(result);
    } catch (error) {
      const key = errorKeyFor(error);
      setFormError(key);
      if (key === 'booking.errors.slotTaken') {
        setValues((prev) => ({ ...prev, time: '' }));
        setReload((n) => n + 1);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setValues(emptyValues());
    setErrors({});
    setFormError(null);
    setCreated(null);
  };

  return { values, errors, formError, submitting, created, availability, availabilityState, set, onChange, onSubmit, reset };
}

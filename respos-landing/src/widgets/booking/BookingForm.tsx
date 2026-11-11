import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarCheck, CircleAlert, CircleCheck, LoaderCircle } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { TextAreaField, TextField } from '@/shared/ui/Field';
import { cx } from '@/shared/lib/cx';
import fieldStyles from '@/shared/ui/Field.module.css';
import { COMMENT_MAX, todayIso, useBooking, type BookingField } from './useBooking';
import styles from './BookingForm.module.css';

const GUEST_OPTIONS = Array.from({ length: 20 }, (_, i) => i + 1);

/** Online table reservation: date + guests → free slots → contact details → pending reservation. */
export function BookingForm({ branchSlug }: { branchSlug: string }) {
  const { t } = useTranslation();
  const booking = useBooking(branchSlug);
  const { values, errors, formError, submitting, created, availability, availabilityState } = booking;
  const successRef = useRef<HTMLHeadingElement>(null);

  const formRef = useRef<HTMLFormElement>(null);
  const focusPending = useRef(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (created) successRef.current?.focus();
  }, [created]);

  // After a failed submit, move focus to the first control with an error (date → time → the rest),
  // so the browser scrolls it into view instead of leaving the visitor on the button.
  useEffect(() => {
    const form = formRef.current;
    if (!focusPending.current || !form) return;
    const wantsTime = Boolean(errors.time) || formError === 'booking.errors.slotTaken';
    if (wantsTime && availabilityState === 'loading') return; // the slots are reloading: wait for them
    focusPending.current = false;
    const invalid = Array.from(form.querySelectorAll<HTMLElement>('[aria-invalid="true"]'));
    const date = invalid.find((element) => element.getAttribute('name') === 'date');
    const time = wantsTime ? form.querySelector<HTMLElement>('input[name="time"]:not(:disabled)') : null;
    (date ?? time ?? invalid[0])?.focus();
  }, [attempt, availabilityState, errors.time, formError]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    await booking.onSubmit(event);
    focusPending.current = true;
    setAttempt((n) => n + 1);
  };

  const errorText = (field: BookingField): string | undefined => {
    const error = errors[field];
    return error ? t(error.key, error.params) : undefined;
  };

  if (created) {
    const time = values.time;
    return (
      <div className={styles.success} role="status">
        <CircleCheck aria-hidden="true" className={styles.successIcon} />
        <h2 ref={successRef} tabIndex={-1} className={styles.successTitle}>{t('booking.success.title')}</h2>
        <p>{t('booking.success.text', { branch: created.branchName, date: values.date, time, guests: created.guests })}</p>
        <Button variant="secondary" onClick={booking.reset}>{t('booking.success.again')}</Button>
      </div>
    );
  }

  const slots = availability?.slots ?? [];
  const hasFree = slots.some((slot) => slot.available);
  const maxGuests = Math.min(availability?.maxGuests ?? GUEST_OPTIONS.length, GUEST_OPTIONS.length);

  return (
    <form ref={formRef} className={styles.form} onSubmit={(e) => void onSubmit(e)} noValidate aria-busy={submitting}>
      {formError && (
        <div className={styles.alert} role="alert">
          <CircleAlert aria-hidden="true" />
          <span>{t(formError)}</span>
        </div>
      )}

      <div className={styles.row}>
        <TextField label={t('booking.fields.date')} name="date" type="date" min={todayIso()} required
          value={values.date} onChange={booking.onChange} error={errorText('date')} />
        <div className={fieldStyles.field}>
          <label className={fieldStyles.label} htmlFor="booking-guests">{t('booking.fields.guests')}</label>
          <select id="booking-guests" name="guests" className={fieldStyles.control} value={values.guests} onChange={booking.onChange}>
            {GUEST_OPTIONS.slice(0, maxGuests).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      <fieldset className={styles.slots} aria-describedby={errors.time ? 'booking-time-error' : undefined}>
        <legend className={fieldStyles.label}>{t('booking.fields.time')}</legend>
        {availabilityState === 'loading' && <p className={styles.muted}><LoaderCircle aria-hidden="true" className={styles.spin} /> {t('booking.slots.loading')}</p>}
        {availabilityState === 'error' && <p className={styles.muted}>{t('booking.errors.availability')}</p>}
        {availabilityState === 'ready' && !hasFree && <p className={styles.muted}>{t('booking.slots.empty')}</p>}
        {availabilityState === 'ready' && hasFree && (
          <>
            <div className={styles.slotGrid}>
              {slots.map((slot) => (
                <label key={slot.time} className={cx(styles.slot, values.time === slot.time && styles.selected, !slot.available && styles.disabled)}>
                  <input type="radio" name="time" value={slot.time} checked={values.time === slot.time}
                    disabled={!slot.available} onChange={booking.onChange} />
                  <span>{slot.time}</span>
                  {!slot.available && <span className={styles.srOnly}> — {t('booking.slots.unavailable')}</span>}
                </label>
              ))}
            </div>
            {availability && <p className={styles.muted}>{t('booking.slots.duration', { minutes: availability.durationMinutes })}</p>}
          </>
        )}
        {errors.time && <p id="booking-time-error" className={fieldStyles.error}>{errorText('time')}</p>}
      </fieldset>

      <div className={styles.row}>
        <TextField label={t('booking.fields.name')} name="name" autoComplete="name" autoCapitalize="words" enterKeyHint="next" required maxLength={100}
          value={values.name} onChange={booking.onChange} error={errorText('name')} />
        <TextField label={t('booking.fields.phone')} name="phone" type="tel" inputMode="tel" autoComplete="tel" enterKeyHint="next"
          placeholder="+998 90 123-45-67" required value={values.phone} onChange={booking.onChange}
          hint={t('booking.fields.phoneHint')} error={errorText('phone')} />
      </div>

      <TextAreaField label={t('booking.fields.comment')} optionalLabel={t('booking.fields.optional')} name="comment" rows={3}
        maxLength={COMMENT_MAX} placeholder={t('booking.fields.commentPlaceholder')} value={values.comment}
        onChange={booking.onChange} error={errorText('comment')} />

      {/* Honeypot: invisible to people and assistive tech, attractive to bots. */}
      <div className={styles.honeypot} aria-hidden="true">
        <label>
          {t('booking.fields.website')}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" value={values.website} onChange={booking.onChange} />
        </label>
      </div>

      <Button type="submit" size="lg" block disabled={submitting}
        icon={submitting ? <LoaderCircle aria-hidden="true" className={styles.spin} /> : <CalendarCheck aria-hidden="true" />}>
        {submitting ? t('booking.submitting') : t('booking.submit')}
      </Button>
    </form>
  );
}

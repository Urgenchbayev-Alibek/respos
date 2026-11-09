import { useEffect, useRef } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CircleAlert, CircleCheck, LoaderCircle, Send } from 'lucide-react';
import { ROUTES } from '@/shared/config/routes';
import { Button } from '@/shared/ui/Button';
import { TextAreaField, TextField } from '@/shared/ui/Field';
import { useDemoForm } from './useDemoForm';
import { LIMITS, type DemoField, type FieldError } from './validation';
import styles from './DemoForm.module.css';

export function DemoForm() {
  const { t } = useTranslation();
  const { values, errors, formError, status, invalidAttempt, onChange, onSubmit, reset } = useDemoForm();
  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (invalidAttempt > 0) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [invalidAttempt]);

  useEffect(() => {
    if (status === 'success') successRef.current?.focus();
  }, [status]);

  const errorText = (field: DemoField): string | undefined => {
    const error: FieldError | undefined = errors[field];
    if (!error) return undefined;
    return 'text' in error ? error.text : t(error.key, error.params);
  };

  if (status === 'success') {
    return (
      <div className={styles.success} role="status">
        <CircleCheck aria-hidden="true" className={styles.successIcon} />
        <h2 ref={successRef} tabIndex={-1} className={styles.successTitle}>
          {t('demo.success.title')}
        </h2>
        <p>{t('demo.success.text')}</p>
        <Button variant="secondary" onClick={reset}>
          {t('demo.success.again')}
        </Button>
      </div>
    );
  }

  const submitting = status === 'submitting';
  const optionalLabel = t('demo.fields.optional');

  return (
    <form ref={formRef} className={styles.form} onSubmit={(e) => void onSubmit(e)} noValidate aria-busy={submitting}>
      {formError && (
        <div className={styles.alert} role="alert">
          <CircleAlert aria-hidden="true" />
          <span>{t(formError)}</span>
        </div>
      )}

      <div className={styles.row}>
        <TextField
          label={t('demo.fields.name')}
          name="name"
          autoComplete="name"
          required
          maxLength={LIMITS.name.max}
          value={values.name}
          onChange={onChange}
          error={errorText('name')}
        />
        <TextField
          label={t('demo.fields.phone')}
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+998 90 123-45-67"
          required
          value={values.phone}
          onChange={onChange}
          hint={t('demo.fields.phoneHint')}
          error={errorText('phone')}
        />
      </div>

      <div className={styles.row}>
        <TextField
          label={t('demo.fields.restaurantName')}
          name="restaurantName"
          autoComplete="organization"
          required
          maxLength={LIMITS.restaurantName.max}
          value={values.restaurantName}
          onChange={onChange}
          error={errorText('restaurantName')}
        />
        <TextField
          label={t('demo.fields.city')}
          optionalLabel={optionalLabel}
          name="city"
          autoComplete="address-level2"
          placeholder={t('demo.fields.cityPlaceholder')}
          maxLength={LIMITS.city.max}
          value={values.city}
          onChange={onChange}
          error={errorText('city')}
        />
      </div>

      <TextField
        label={t('demo.fields.email')}
        optionalLabel={optionalLabel}
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        value={values.email}
        onChange={onChange}
        error={errorText('email')}
      />

      <TextAreaField
        label={t('demo.fields.message')}
        optionalLabel={optionalLabel}
        name="message"
        rows={4}
        placeholder={t('demo.fields.messagePlaceholder')}
        value={values.message}
        onChange={onChange}
        error={errorText('message')}
      />

      {/* Honeypot: invisible to people and assistive tech, attractive to bots. */}
      <div className={styles.honeypot} aria-hidden="true">
        <label>
          {t('demo.fields.website')}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" value={values.website} onChange={onChange} />
        </label>
      </div>

      <p className={styles.consent}>
        <Trans i18nKey="demo.consent" components={{ privacy: <Link to={ROUTES.privacy} /> }} />
      </p>

      <Button
        type="submit"
        size="lg"
        block
        disabled={submitting}
        icon={submitting ? <LoaderCircle aria-hidden="true" className={styles.spin} /> : <Send aria-hidden="true" />}
      >
        {submitting ? t('demo.submitting') : t('demo.submit')}
      </Button>
    </form>
  );
}

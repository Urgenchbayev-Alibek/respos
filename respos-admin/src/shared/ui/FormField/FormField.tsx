import clsx from 'clsx';
import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FieldContext } from './field-context';
import styles from './FormField.module.css';

export interface FormFieldProps {
  label: ReactNode;
  /** Error text or i18n key (zod schemas use `validation:*` keys). */
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  id?: string;
  className?: string;
  children: ReactNode;
}

/** Label + control + error right next to the field (spec §6.4). */
export function FormField({ label, error, hint, required = false, id, className, children }: FormFieldProps) {
  const { t } = useTranslation();
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;

  return (
    <FieldContext.Provider value={{ id: fieldId, describedBy, invalid: Boolean(error), required }}>
      <div className={clsx(styles.field, className)}>
        <label htmlFor={fieldId} className={styles.label}>
          {label}
          {required && (
            <span className={styles.required} aria-hidden="true">
              *
            </span>
          )}
        </label>
        {children}
        {hint && !error && (
          <p id={hintId} className={styles.hint}>
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} className={styles.error} role="alert">
            {t(error, { defaultValue: error })}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  );
}

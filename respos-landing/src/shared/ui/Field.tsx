import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cx } from '@/shared/lib/cx';
import styles from './Field.module.css';

interface FieldFrameProps {
  label: ReactNode;
  /** Text appended to the label for optional fields, e.g. "необязательно". */
  optionalLabel?: string;
  hint?: ReactNode;
  error?: string;
}

interface FrameRenderProps {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
}

function FieldFrame({
  label,
  optionalLabel,
  hint,
  error,
  children,
}: FieldFrameProps & { children: (props: FrameRenderProps) => ReactNode }) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
        {optionalLabel && <span className={styles.optional}> ({optionalLabel})</span>}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}

type TextFieldProps = FieldFrameProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'id'>;

export function TextField({ label, optionalLabel, hint, error, className, ...input }: TextFieldProps) {
  return (
    <FieldFrame label={label} optionalLabel={optionalLabel} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          className={cx(styles.control, invalid && styles.invalid, className)}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          {...input}
        />
      )}
    </FieldFrame>
  );
}

type TextAreaFieldProps = FieldFrameProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'>;

export function TextAreaField({ label, optionalLabel, hint, error, className, ...area }: TextAreaFieldProps) {
  return (
    <FieldFrame label={label} optionalLabel={optionalLabel} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          className={cx(styles.control, styles.textarea, invalid && styles.invalid, className)}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          {...area}
        />
      )}
    </FieldFrame>
  );
}

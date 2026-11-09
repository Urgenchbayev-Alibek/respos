import { useId } from 'react';
import { Checkbox } from '@/shared/ui';
import styles from './UserForm.module.css';

export interface CheckboxGroupProps {
  legend: string;
  options: { value: string; label: string; description?: string }[];
  value: string[];
  onChange: (value: string[]) => void;
  /** Already translated error text. */
  errorText?: string;
  hint?: string;
}

/** Multi-select as a checkbox list (roles, branches). */
export function CheckboxGroup({ legend, options, value, onChange, errorText, hint }: CheckboxGroupProps) {
  const errorId = useId();
  const toggle = (id: string, checked: boolean) =>
    onChange(checked ? [...value, id] : value.filter((item) => item !== id));

  return (
    <fieldset className={styles.group} aria-describedby={errorText ? errorId : undefined} data-span="full">
      <legend className={styles.legend}>{legend}</legend>
      {hint && <p className={styles.hint}>{hint}</p>}
      <div className={styles.options}>
        {options.map((option) => (
          <Checkbox
            key={option.value}
            label={option.label}
            description={option.description}
            checked={value.includes(option.value)}
            onChange={(event) => toggle(option.value, event.target.checked)}
          />
        ))}
      </div>
      {errorText && (
        <p id={errorId} className={styles.error} role="alert">
          {errorText}
        </p>
      )}
    </fieldset>
  );
}

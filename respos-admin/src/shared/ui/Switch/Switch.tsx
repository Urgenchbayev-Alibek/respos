import clsx from 'clsx';
import type { ReactNode } from 'react';
import { useControlProps } from '../FormField/use-control-props';
import styles from './Switch.module.css';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
  id?: string;
  name?: string;
  className?: string;
}

/** Accessible toggle (`role="switch"`), works with RHF via <Controller>. */
export function Switch({ checked, onChange, label, disabled, id, name, className }: SwitchProps) {
  const a11y = useControlProps({ id });
  return (
    <span className={clsx(styles.wrapper, className)}>
      <button
        type="button"
        role="switch"
        id={a11y.id}
        name={name}
        aria-checked={checked}
        aria-describedby={a11y['aria-describedby']}
        disabled={disabled}
        className={clsx(styles.track, checked && styles.on)}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.thumb} />
      </button>
      {label && (
        <label htmlFor={a11y.id} className={styles.label}>
          {label}
        </label>
      )}
    </span>
  );
}

import { Minus, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MAX_LINE_QUANTITY } from '../model/cart';
import styles from './QuantityStepper.module.css';

export interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  /** Item name for accessible labels. */
  label: string;
  min?: number;
  /** When set, "−" at the minimum turns into a remove button. */
  onRemove?: () => void;
}

/** −/+ with 44px touch targets. */
export function QuantityStepper({ value, onChange, label, min = 1, onRemove }: QuantityStepperProps) {
  const { t } = useTranslation('waiter');
  const atMin = value <= min;
  const showRemove = atMin && onRemove;
  return (
    <span className={styles.stepper}>
      <button
        type="button"
        className={styles.button}
        aria-label={showRemove ? t('cart.remove', { name: label }) : t('cart.decrease', { name: label })}
        disabled={atMin && !onRemove}
        onClick={() => (showRemove ? onRemove() : onChange(value - 1))}
      >
        {showRemove ? <Trash2 aria-hidden="true" /> : <Minus aria-hidden="true" />}
      </button>
      <span className={styles.value} aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className={styles.button}
        aria-label={t('cart.increase', { name: label })}
        disabled={value >= MAX_LINE_QUANTITY}
        onClick={() => onChange(value + 1)}
      >
        <Plus aria-hidden="true" />
      </button>
    </span>
  );
}

import { Delete } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './shared-device.module.css';

export const PIN_MAX_LENGTH = 6;
export const PIN_MIN_LENGTH = 4;

export interface PinPadProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  /** The last PIN was rejected: the dots shake once (the page keeps its Alert for the message). */
  invalid?: boolean;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

/** Large-touch numeric keypad (also accepts the physical keyboard: digits, Backspace, Enter). */
export function PinPad({ value, onChange, onSubmit, disabled, invalid }: PinPadProps) {
  const { t } = useTranslation('staff');
  const press = (digit: string) => {
    if (!disabled && value.length < PIN_MAX_LENGTH) onChange(value + digit);
  };
  const erase = () => !disabled && onChange(value.slice(0, -1));
  const canSubmit = !disabled && value.length >= PIN_MIN_LENGTH;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (disabled) return;
      if (/^\d$/.test(event.key)) {
        if (value.length < PIN_MAX_LENGTH) onChange(value + event.key);
      } else if (event.key === 'Backspace') {
        onChange(value.slice(0, -1));
      } else if (event.key === 'Enter' && value.length >= PIN_MIN_LENGTH) {
        onSubmit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [disabled, onChange, onSubmit, value]);

  return (
    <div className={styles.pad}>
      <div
        className={styles.dots}
        role="status"
        aria-label={t('lock.pinEntered', { count: value.length })}
        data-invalid={invalid || undefined}
      >
        {Array.from({ length: PIN_MAX_LENGTH }, (_, index) => (
          <span key={index} className={index < value.length ? styles.dotFilled : styles.dot} aria-hidden="true" />
        ))}
      </div>
      <div className={styles.keys}>
        {KEYS.map((digit) => (
          <button key={digit} type="button" className={styles.key} onClick={() => press(digit)} disabled={disabled}>
            {digit}
          </button>
        ))}
        <button type="button" className={styles.key} onClick={erase} disabled={disabled} aria-label={t('lock.erase')}>
          <Delete aria-hidden="true" />
        </button>
        <button type="button" className={styles.key} onClick={() => press('0')} disabled={disabled}>
          0
        </button>
        <button type="button" className={styles.keyPrimary} onClick={onSubmit} disabled={!canSubmit}>
          {t('lock.enter')}
        </button>
      </div>
    </div>
  );
}

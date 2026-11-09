import clsx from 'clsx';
import { forwardRef, useEffect, useState, type InputHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { formatCurrency, parseMoneyInput } from '@/shared/lib/format-currency';
import { useControlProps } from '../FormField/use-control-props';
import controlStyles from '../theme/control.module.css';

export interface MoneyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  /** Currency code shown as suffix (org currency). */
  currency?: string;
  invalid?: boolean;
}

/** Numeric money entry: shows grouped value on blur, raw while editing; emits number (≤ 2 decimals) or null. */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { value, onChange, currency, invalid, className, id, required, onBlur, onFocus, ...rest },
  ref,
) {
  const { i18n } = useTranslation();
  const a11y = useControlProps({ id, invalid, required, 'aria-describedby': rest['aria-describedby'] });
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState('');

  useEffect(() => {
    if (focused) return;
    setText(value === null || value === undefined ? '' : formatCurrency(value, { locale: i18n.language, withCurrency: false }));
  }, [value, focused, i18n.language]);

  return (
    <span className={controlStyles.withAffix}>
      <input
        ref={ref}
        inputMode="decimal"
        autoComplete="off"
        className={clsx(controlStyles.control, className)}
        value={text}
        onFocus={(event) => {
          setFocused(true);
          setText(value === null || value === undefined ? '' : String(value));
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        onChange={(event) => {
          setText(event.target.value);
          onChange(parseMoneyInput(event.target.value));
        }}
        {...a11y}
        {...rest}
      />
      {currency && <span className={controlStyles.suffix}>{currency}</span>}
    </span>
  );
});

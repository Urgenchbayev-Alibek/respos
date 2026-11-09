import clsx from 'clsx';
import { forwardRef, type SelectHTMLAttributes } from 'react';
import { useControlProps } from '../FormField/use-control-props';
import controlStyles from '../theme/control.module.css';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  options: SelectOption[];
  /** Adds an empty first option (e.g. "All" in filters, "Select…" in forms). */
  placeholder?: string;
  invalid?: boolean;
}

/** Native select (best keyboard + mobile support). */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { options, placeholder, invalid, className, id, required, 'aria-describedby': describedBy, ...rest },
  ref,
) {
  const a11y = useControlProps({ id, invalid, required, 'aria-describedby': describedBy });
  return (
    <select ref={ref} className={clsx(controlStyles.control, controlStyles.select, className)} {...a11y} {...rest}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  );
});

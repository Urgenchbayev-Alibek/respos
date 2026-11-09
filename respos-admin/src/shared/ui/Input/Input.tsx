import clsx from 'clsx';
import { forwardRef, type InputHTMLAttributes } from 'react';
import { useControlProps } from '../FormField/use-control-props';
import controlStyles from '../theme/control.module.css';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, className, id, required, 'aria-describedby': describedBy, ...rest },
  ref,
) {
  const a11y = useControlProps({ id, invalid, required, 'aria-describedby': describedBy });
  return <input ref={ref} className={clsx(controlStyles.control, className)} {...a11y} {...rest} />;
});

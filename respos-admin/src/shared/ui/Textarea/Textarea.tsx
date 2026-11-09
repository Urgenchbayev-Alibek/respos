import clsx from 'clsx';
import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { useControlProps } from '../FormField/use-control-props';
import controlStyles from '../theme/control.module.css';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, className, id, required, 'aria-describedby': describedBy, rows = 3, ...rest },
  ref,
) {
  const a11y = useControlProps({ id, invalid, required, 'aria-describedby': describedBy });
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={clsx(controlStyles.control, controlStyles.textarea, className)}
      {...a11y}
      {...rest}
    />
  );
});

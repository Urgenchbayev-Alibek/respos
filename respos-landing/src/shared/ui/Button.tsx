import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cx } from '@/shared/lib/cx';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'ghost' | 'inverse';
type Size = 'md' | 'lg';

interface StyleProps {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  icon?: ReactNode;
}

const classes = ({ variant = 'primary', size = 'md', block }: StyleProps, extra?: string): string =>
  cx(styles.button, styles[variant], size === 'lg' && styles.lg, block && styles.block, extra);

export function Button({
  variant,
  size,
  block,
  icon,
  className,
  children,
  type = 'button',
  ...rest
}: StyleProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={classes({ variant, size, block }, className)} {...rest}>
      {children}
      {icon}
    </button>
  );
}

/** Internal navigation styled as a button. */
export function ButtonLink({ variant, size, block, icon, className, children, ...rest }: StyleProps & LinkProps) {
  return (
    <Link className={classes({ variant, size, block }, className)} {...rest}>
      {children}
      {icon}
    </Link>
  );
}

/** External link (e.g. the admin app) styled as a button. */
export function ButtonAnchor({
  variant,
  size,
  block,
  icon,
  className,
  children,
  ...rest
}: StyleProps & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a className={classes({ variant, size, block }, className)} {...rest}>
      {children}
      {icon}
    </a>
  );
}

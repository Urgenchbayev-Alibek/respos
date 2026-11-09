import clsx from 'clsx';
import { Search } from 'lucide-react';
import type { InputHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import controlStyles from '../theme/control.module.css';

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  value: string;
  onChange: (value: string) => void;
}

/** Search box for toolbars. Debounce the value with useDebouncedValue before putting it in a query key. */
export function SearchInput({ value, onChange, className, placeholder, ...rest }: SearchInputProps) {
  const { t } = useTranslation();
  const label = placeholder ?? t('common:actions.search');
  return (
    <span className={clsx(controlStyles.withAffix, controlStyles.withPrefix, className)}>
      <span className={controlStyles.prefix} aria-hidden="true">
        <Search />
      </span>
      <input
        type="search"
        className={controlStyles.control}
        value={value}
        placeholder={label}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        {...rest}
      />
    </span>
  );
}

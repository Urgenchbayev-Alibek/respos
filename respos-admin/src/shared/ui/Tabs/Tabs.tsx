import clsx from 'clsx';
import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import styles from './Tabs.module.css';

export interface TabItem {
  id: string;
  label: ReactNode;
  /** Router tabs: render as links (sub-pages). Omit for in-page tabs. */
  to?: string;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  value?: string;
  onChange?: (id: string) => void;
  ariaLabel: string;
  className?: string;
}

/** In-page tabs (role=tablist with arrow keys) or route tabs (links) when items have `to`. */
export function Tabs({ items, value, onChange, ariaLabel, className }: TabsProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const isRouteTabs = items.some((item) => item.to);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const buttons = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[data-tab]:not([disabled])') ?? []);
    const index = buttons.indexOf(document.activeElement as HTMLElement);
    if (index < 0) return;
    const next = buttons[(index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length];
    next?.focus();
    next?.click();
  };

  if (isRouteTabs) {
    return (
      <nav aria-label={ariaLabel} className={clsx(styles.tabs, className)}>
        {items.map((item) => (
          <NavLink
            key={item.id}
            to={item.to ?? '.'}
            end
            className={({ isActive }) => clsx(styles.tab, isActive && styles.active)}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    );
  }

  return (
    <div ref={listRef} role="tablist" aria-label={ariaLabel} className={clsx(styles.tabs, className)} onKeyDown={onKeyDown}>
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            data-tab
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            className={clsx(styles.tab, selected && styles.active)}
            onClick={() => onChange?.(item.id)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

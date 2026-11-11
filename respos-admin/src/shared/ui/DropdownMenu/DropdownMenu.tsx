import clsx from 'clsx';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import styles from './DropdownMenu.module.css';

export interface DropdownMenuItem {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Marks the current choice (language, branch…). */
  selected?: boolean;
}

export interface DropdownMenuProps {
  /** Render the trigger; spread `triggerProps` on a button. */
  trigger: (triggerProps: {
    'aria-haspopup': 'menu';
    'aria-expanded': boolean;
    'aria-controls': string;
    onClick: (event?: ReactMouseEvent<HTMLElement>) => void;
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  }) => ReactNode;
  items: DropdownMenuItem[];
  align?: 'start' | 'end';
  header?: ReactNode;
}

/** Accessible menu button: Enter/Space/ArrowDown open, arrows move, Escape closes, click outside closes. */
export function DropdownMenu({ trigger, items, align = 'end', header }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  /** Opened from the keyboard (Enter / Space click has detail 0, ArrowDown): skip the entrance transition. */
  const [instant, setInstant] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    const first = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])');
    first?.focus();
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const moveFocus = (delta: number) => {
    const elements = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []);
    const index = elements.indexOf(document.activeElement as HTMLElement);
    elements[(index + delta + elements.length) % elements.length]?.focus();
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown') moveFocus(1);
    else if (event.key === 'ArrowUp') moveFocus(-1);
    else if (event.key === 'Escape' || event.key === 'Tab') {
      setOpen(false);
      rootRef.current?.querySelector<HTMLElement>('[aria-haspopup="menu"]')?.focus();
    } else return;
    if (event.key !== 'Tab') event.preventDefault();
  };

  return (
    <div ref={rootRef} className={styles.root}>
      {trigger({
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': menuId,
        onClick: (event) => {
          setInstant(event?.detail === 0);
          setOpen((value) => !value);
        },
        onKeyDown: (event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setInstant(true);
            setOpen(true);
          }
        },
      })}
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          className={clsx(styles.menu, styles[align])}
          data-instant={instant || undefined}
          onKeyDown={onMenuKeyDown}
        >
          {header && <div className={styles.header}>{header}</div>}
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              aria-current={item.selected || undefined}
              className={clsx(styles.item, item.danger && styles.danger, item.selected && styles.selected)}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.icon && <span className={styles.icon}>{item.icon}</span>}
              <span className={styles.label}>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

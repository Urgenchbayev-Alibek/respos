import { useEffect, useRef, useSyncExternalStore } from 'react';

/**
 * Keyboard shortcuts for operational screens (cashier/waiter). Keys: `F2`, `Enter`, `1`, `/`, `?`, `Ctrl+Enter`
 * (`Ctrl` also matches ⌘ on macOS). Plain keys never fire while focus is in a text field, and `Enter`/`Space`
 * never hijack a focused button or link. Nothing fires while a dialog is open (except its own handlers).
 * Registered shortcuts are listed by the `?` overlay (`widgets/shortcuts/ShortcutsOverlay`).
 */
export interface Shortcut {
  /** e.g. `F2`, `Enter`, `1`, `/`, `Ctrl+Enter`. */
  keys: string;
  /** Already translated description for the `?` overlay. */
  label: string;
  handler: (event: KeyboardEvent) => void;
  enabled?: boolean;
  /** Default: true for `Ctrl+…`, `Alt+…` and F-keys, false for plain keys. */
  allowInInputs?: boolean;
}

export interface ShortcutInfo {
  keys: string;
  label: string;
}

interface ParsedKeys {
  key: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
}

export function parseKeys(keys: string): ParsedKeys {
  const parts = keys.split('+').map((part) => part.trim());
  const key = parts.pop() || '+';
  const mods = parts.map((part) => part.toLowerCase());
  return { key: key.toLowerCase(), ctrl: mods.includes('ctrl'), alt: mods.includes('alt'), shift: mods.includes('shift') };
}

export function matchesKeys(event: KeyboardEvent, keys: string): boolean {
  const parsed = parseKeys(keys);
  if (event.key.toLowerCase() !== parsed.key) return false;
  if ((event.ctrlKey || event.metaKey) !== parsed.ctrl || event.altKey !== parsed.alt) return false;
  // Printable symbols (`?`, `/`) already encode Shift in `event.key`.
  const isSymbol = parsed.key.length === 1 && !/[a-z]/.test(parsed.key);
  return isSymbol || event.shiftKey === parsed.shift;
}

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'number', 'password', 'tel', 'url', 'date', 'time', 'datetime-local']);

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  return target instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(target.type);
}

function isActivatableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest('button, a[href], summary, [role="button"], [role="menuitem"]'));
}

function allowsInputs(shortcut: Shortcut, parsed: ParsedKeys): boolean {
  return shortcut.allowInInputs ?? (parsed.ctrl || parsed.alt || /^f\d{1,2}$/.test(parsed.key));
}

/** Decides whether `shortcut` should run for `event` (exported for tests). */
export function shouldHandle(event: KeyboardEvent, shortcut: Shortcut): boolean {
  if (shortcut.enabled === false || event.defaultPrevented || event.isComposing || event.repeat) return false;
  if (!matchesKeys(event, shortcut.keys)) return false;
  const parsed = parseKeys(shortcut.keys);
  if (isEditableTarget(event.target) && !allowsInputs(shortcut, parsed)) return false;
  const plain = !parsed.ctrl && !parsed.alt;
  if (plain && (parsed.key === 'enter' || parsed.key === ' ') && isActivatableTarget(event.target)) return false;
  return !document.querySelector('[aria-modal="true"]');
}

/* Registry of active shortcuts (for the `?` overlay). */
const registry = new Map<symbol, ShortcutInfo[]>();
const listeners = new Set<() => void>();
let snapshot: ShortcutInfo[] = [];

function publish(): void {
  snapshot = [...registry.values()].flat();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRegisteredShortcuts(): ShortcutInfo[] {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}

/** Registers shortcuts while the component is mounted. Handlers may change every render. */
export function useShortcuts(shortcuts: Shortcut[]): void {
  const latest = useRef(shortcuts);
  latest.current = shortcuts;
  const signature = shortcuts.map((s) => `${s.keys}|${s.label}|${s.enabled !== false}`).join('\n');

  useEffect(() => {
    const id = Symbol('shortcuts');
    registry.set(
      id,
      latest.current.filter((s) => s.enabled !== false).map(({ keys, label }) => ({ keys, label })),
    );
    publish();
    const onKeyDown = (event: KeyboardEvent) => {
      const shortcut = latest.current.find((candidate) => shouldHandle(event, candidate));
      if (!shortcut) return;
      event.preventDefault();
      shortcut.handler(event);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      registry.delete(id);
      publish();
    };
  }, [signature]);
}

/** Stable DOM hooks for shortcut targets: `<SearchInput data-shortcut="menu-search" />`. */
export function shortcutTarget(name: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-shortcut="${name}"]`);
}

export function focusShortcutTarget(name: string): void {
  const element = shortcutTarget(name);
  element?.focus();
  if (element instanceof HTMLInputElement) element.select();
}

export function clickShortcutTarget(name: string): void {
  const element = shortcutTarget(name);
  if (element instanceof HTMLButtonElement && element.disabled) return;
  element?.click();
}

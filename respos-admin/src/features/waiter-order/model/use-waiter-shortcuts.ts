import { useTranslation } from 'react-i18next';
import { clickShortcutTarget, focusShortcutTarget, useShortcuts } from '@/shared/hooks/use-shortcuts';

/** Waiter order screen: `/` — menu search, Ctrl+Enter — send to kitchen (works from the search box too). */
export function useWaiterShortcuts(): void {
  const { t } = useTranslation('ux');
  useShortcuts([
    { keys: '/', label: t('shortcuts.waiter.search'), handler: () => focusShortcutTarget('menu-search') },
    { keys: 'Ctrl+Enter', label: t('shortcuts.waiter.send'), handler: () => clickShortcutTarget('send-to-kitchen') },
  ]);
}

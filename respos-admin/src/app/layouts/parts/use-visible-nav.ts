import { useMemo } from 'react';
import type { NavItem } from '@/app/navigation/nav-types';
import { usePermissions } from '@/shared/hooks/use-permissions';

/** Nav items the user may see (UX only). */
export function useVisibleNav(items: readonly NavItem[]): NavItem[] {
  const { hasAny } = usePermissions();
  return useMemo(() => items.filter((item) => hasAny(item.anyOf)), [items, hasAny]);
}

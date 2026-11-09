import type { LucideIcon } from 'lucide-react';
import type { Permission } from '@/shared/constants/permissions';

export interface NavItem {
  id: string;
  /** i18n key, usually in the `nav` namespace. */
  labelKey: string;
  path: string;
  icon: LucideIcon;
  /** Shown if the user has ANY of these (empty = always). UX only. */
  anyOf: readonly Permission[];
  /** Match the path exactly (workspace home). */
  end?: boolean;
}

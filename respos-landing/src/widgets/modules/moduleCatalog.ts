import {
  BookOpen,
  Building2,
  ChartColumn,
  ChefHat,
  ClipboardList,
  LayoutGrid,
  Package,
  ShieldCheck,
  Truck,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

/** Product modules in display order; texts live under `features.modules.<id>`. */
export const MODULES: { id: string; icon: LucideIcon }[] = [
  { id: 'tables', icon: LayoutGrid },
  { id: 'menu', icon: BookOpen },
  { id: 'orders', icon: ClipboardList },
  { id: 'kds', icon: ChefHat },
  { id: 'inventory', icon: Package },
  { id: 'procurement', icon: Truck },
  { id: 'payments', icon: Wallet },
  { id: 'reports', icon: ChartColumn },
  { id: 'roles', icon: ShieldCheck },
  { id: 'saas', icon: Building2 },
];

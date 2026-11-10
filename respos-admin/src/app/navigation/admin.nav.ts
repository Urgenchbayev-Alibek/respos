import {
  Armchair,
  Boxes,
  Building2,
  Banknote,
  Bell,
  BookOpenText,
  CalendarClock,
  Contact,
  ChefHat,
  ClipboardList,
  CookingPot,
  FileClock,
  LayoutDashboard,
  LineChart,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { ROUTES } from '@/shared/constants/routes';
import type { NavItem } from './nav-types';

/** Admin sidebar — the 18 sections of spec §5.1, in spec order. */
export const ADMIN_NAV: readonly NavItem[] = [
  { id: 'dashboard', labelKey: 'nav:admin.dashboard', path: ROUTES.admin.dashboard, icon: LayoutDashboard, anyOf: [], end: true },
  { id: 'branches', labelKey: 'nav:admin.branches', path: ROUTES.admin.branches, icon: Building2, anyOf: [P.branches.read] },
  { id: 'users', labelKey: 'nav:admin.users', path: ROUTES.admin.users, icon: Users, anyOf: [P.users.read, P.roles.read] },
  { id: 'tables', labelKey: 'nav:admin.tables', path: ROUTES.admin.tables, icon: Armchair, anyOf: [P.tables.read] },
  { id: 'reservations', labelKey: 'nav:admin.reservations', path: ROUTES.admin.reservations, icon: CalendarClock, anyOf: [P.reservations.read] },
  { id: 'menu', labelKey: 'nav:admin.menu', path: ROUTES.admin.menu, icon: BookOpenText, anyOf: [P.menu.read] },
  { id: 'kitchenStations', labelKey: 'nav:admin.kitchenStations', path: ROUTES.admin.kitchenStations, icon: ChefHat, anyOf: [P.kitchen.read] },
  { id: 'customers', labelKey: 'nav:admin.customers', path: ROUTES.admin.customers, icon: Contact, anyOf: [P.customers.read] },
  { id: 'orders', labelKey: 'nav:admin.orders', path: ROUTES.admin.orders, icon: ClipboardList, anyOf: [P.orders.read] },
  { id: 'inventory', labelKey: 'nav:admin.inventory', path: ROUTES.admin.inventory, icon: Boxes, anyOf: [P.inventory.read] },
  { id: 'recipes', labelKey: 'nav:admin.recipes', path: ROUTES.admin.recipes, icon: CookingPot, anyOf: [P.recipes.read] },
  { id: 'suppliers', labelKey: 'nav:admin.suppliers', path: ROUTES.admin.suppliers, icon: Truck, anyOf: [P.suppliers.read] },
  { id: 'purchases', labelKey: 'nav:admin.purchases', path: ROUTES.admin.purchases, icon: ShoppingCart, anyOf: [P.purchases.read] },
  { id: 'payments', labelKey: 'nav:admin.payments', path: ROUTES.admin.payments, icon: Banknote, anyOf: [P.payments.read] },
  { id: 'cashShifts', labelKey: 'nav:admin.cashShifts', path: ROUTES.admin.cashShifts, icon: Wallet, anyOf: [P.cashShifts.read] },
  { id: 'reports', labelKey: 'nav:admin.reports', path: ROUTES.admin.reports, icon: LineChart, anyOf: [P.reports.read] },
  { id: 'notifications', labelKey: 'nav:admin.notifications', path: ROUTES.admin.notifications, icon: Bell, anyOf: [P.notifications.read] },
  { id: 'auditLogs', labelKey: 'nav:admin.auditLogs', path: ROUTES.admin.auditLogs, icon: FileClock, anyOf: [P.audit.read] },
  { id: 'settings', labelKey: 'nav:admin.settings', path: ROUTES.admin.settings, icon: Settings, anyOf: [P.settings.manage] },
];

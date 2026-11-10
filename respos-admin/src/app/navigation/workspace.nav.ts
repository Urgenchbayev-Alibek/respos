import {
  Activity,
  BellRing,
  Bike,
  Building,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  CookingPot,
  CreditCard,
  Flag,
  Inbox,
  LayoutGrid,
  Layers,
  Package,
  Receipt,
  ShoppingCart,
  Truck,
  Wallet,
} from 'lucide-react';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { ROUTES } from '@/shared/constants/routes';
import type { NavItem } from './nav-types';

/** Navigation of the operational workspaces. Add an item here when adding a workspace page. */
export const WAITER_NAV: readonly NavItem[] = [
  { id: 'tables', labelKey: 'nav:waiter.tables', path: ROUTES.waiter.tables, icon: LayoutGrid, anyOf: [P.tables.read], end: true },
  { id: 'orders', labelKey: 'nav:waiter.orders', path: ROUTES.waiter.orders, icon: ClipboardList, anyOf: [P.orders.read] },
  { id: 'reservations', labelKey: 'nav:waiter.reservations', path: ROUTES.waiter.reservations, icon: CalendarClock, anyOf: [P.reservations.read] },
  { id: 'calls', labelKey: 'qrMenu:calls.nav', path: ROUTES.waiter.calls, icon: BellRing, anyOf: [P.orders.read] },
];

export const CASHIER_NAV: readonly NavItem[] = [
  { id: 'orders', labelKey: 'nav:cashier.orders', path: ROUTES.cashier.orders, icon: Receipt, anyOf: [P.orders.read], end: true },
  { id: 'shift', labelKey: 'nav:cashier.shift', path: ROUTES.cashier.shift, icon: Wallet, anyOf: [P.cashShifts.read] },
  { id: 'payments', labelKey: 'nav:cashier.payments', path: ROUTES.cashier.payments, icon: CreditCard, anyOf: [P.payments.read] },
  { id: 'delivery', labelKey: 'delivery:nav', path: ROUTES.cashier.delivery, icon: Bike, anyOf: [P.delivery.read] },
];

export const STOCK_NAV: readonly NavItem[] = [
  { id: 'inventory', labelKey: 'nav:stock.inventory', path: ROUTES.stock.inventory, icon: Package, anyOf: [P.inventory.read], end: true },
  { id: 'purchases', labelKey: 'nav:stock.purchases', path: ROUTES.stock.purchases, icon: ShoppingCart, anyOf: [P.purchases.read] },
  { id: 'counts', labelKey: 'nav:stock.counts', path: ROUTES.stock.counts, icon: ClipboardCheck, anyOf: [P.inventory.adjust] },
  { id: 'suppliers', labelKey: 'nav:stock.suppliers', path: ROUTES.stock.suppliers, icon: Truck, anyOf: [P.suppliers.read] },
  { id: 'recipes', labelKey: 'nav:stock.recipes', path: ROUTES.stock.recipes, icon: CookingPot, anyOf: [P.recipes.read] },
];

export const PLATFORM_NAV: readonly NavItem[] = [
  { id: 'organizations', labelKey: 'nav:platform.organizations', path: ROUTES.platform.organizations, icon: Building, anyOf: [P.platform.organizationsRead], end: true },
  { id: 'plans', labelKey: 'nav:platform.plans', path: ROUTES.platform.plans, icon: Layers, anyOf: [P.platform.plansManage] },
  { id: 'featureFlags', labelKey: 'nav:platform.featureFlags', path: ROUTES.platform.featureFlags, icon: Flag, anyOf: [P.platform.featureFlagsManage] },
  { id: 'system', labelKey: 'nav:platform.system', path: ROUTES.platform.system, icon: Activity, anyOf: [P.platform.systemRead] },
  { id: 'demoRequests', labelKey: 'nav:platform.demoRequests', path: ROUTES.platform.demoRequests, icon: Inbox, anyOf: [P.platform.demoRequestsRead] },
];

import { CASHIER_NAV, PLATFORM_NAV, STOCK_NAV, WAITER_NAV } from '@/app/navigation/workspace.nav';
import { WaiterCallAlerts } from '@/features/waiter-calls/WaiterCallAlerts';
import { WorkspaceLayout } from './WorkspaceLayout/WorkspaceLayout';

/** Waiter workspace: tablet-first, bottom nav on phones, live connection indicator. */
export function WaiterLayout() {
  return (
    <>
      <WaiterCallAlerts />
      <WorkspaceLayout workspace="waiter" nav={WAITER_NAV} showConnection />
    </>
  );
}

export function CashierLayout() {
  return <WorkspaceLayout workspace="cashier" nav={CASHIER_NAV} showConnection />;
}

export function StockLayout() {
  return <WorkspaceLayout workspace="stock" nav={STOCK_NAV} />;
}

/** Platform Super Admin: no branch context. */
export function PlatformLayout() {
  return <WorkspaceLayout workspace="platform" nav={PLATFORM_NAV} showBranch={false} />;
}

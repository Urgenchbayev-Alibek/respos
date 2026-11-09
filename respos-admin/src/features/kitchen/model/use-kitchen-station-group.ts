import { useEffect } from 'react';
import { HUB_METHODS, hubManager } from '@/shared/realtime';

/** Joins the SignalR kitchen group (null = all stations) on every (re)connect; leaves on change/unmount. */
export function useKitchenStationGroup(branchId: string | null, stationId: string | null): void {
  useEffect(() => {
    if (!branchId) return;
    const unsubscribe = hubManager.onConnected((connection) =>
      connection.invoke(HUB_METHODS.joinKitchenStation, branchId, stationId),
    );
    return () => {
      unsubscribe();
      hubManager.invoke(HUB_METHODS.leaveKitchenStation, branchId, stationId).catch((error: unknown) => {
        console.warn('[kds] leaving station group failed', error);
      });
    };
  }, [branchId, stationId]);
}

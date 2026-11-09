import { useCallback, useState } from 'react';
import { safeStorage } from '@/shared/lib/safe-storage';

/** Per-device KDS preferences (a TV in the hot shop always shows "its" station). */
const STATION_KEY = 'respos.kds.station';
export const ALL_STATIONS = 'all';

export function useStoredStation(): [string, (stationId: string) => void] {
  const [station, setStation] = useState(() => safeStorage.get(STATION_KEY) ?? ALL_STATIONS);
  const update = useCallback((next: string) => {
    setStation(next);
    safeStorage.set(STATION_KEY, next);
  }, []);
  return [station, update];
}

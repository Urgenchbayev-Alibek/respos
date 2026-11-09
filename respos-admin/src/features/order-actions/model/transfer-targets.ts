import type { TableDto } from '@/entities/table/table.types';

/** Free tables a dine-in order can move to (the server re-checks: active, not unavailable). */
export function transferTargets(tables: TableDto[], currentTableId: string | null): TableDto[] {
  return tables.filter(
    (table) =>
      table.id !== currentTableId && table.isActive && (table.status === 'available' || table.status === 'reserved'),
  );
}

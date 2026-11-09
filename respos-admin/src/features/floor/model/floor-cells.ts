import type { TableDto } from '@/entities/table/table.types';

/** Largest grid cell the floor editor accepts (validation: 0–99). */
const MAX_CELL = 99;

export type FloorCell = { column: number; row: number };

const isCell = (value: number | null | undefined): value is number =>
  value !== null && value !== undefined && Number.isInteger(value) && value >= 0 && value <= MAX_CELL;

/**
 * Explicit grid placement per table, or `null` for every table when the positions cannot be used as a grid:
 * out-of-range values (e.g. legacy pixel coordinates) or two tables on the same cell (e.g. "all areas" view,
 * where each area has its own plan). Placing such tiles would stack them on top of each other or create
 * thousands of empty columns, so they flow in list order (area, number) instead.
 */
export function resolveFloorCells(tables: TableDto[]): Map<string, FloorCell> | null {
  const cells = new Map<string, FloorCell>();
  const taken = new Set<string>();
  for (const table of tables) {
    const hasX = table.posX !== null && table.posX !== undefined;
    const hasY = table.posY !== null && table.posY !== undefined;
    if (!hasX && !hasY) continue;
    if ((hasX && !isCell(table.posX)) || (hasY && !isCell(table.posY))) return null;
    const cell = { column: table.posX ?? 0, row: table.posY ?? 0 };
    const key = `${cell.column}:${cell.row}`;
    if (taken.has(key)) return null;
    taken.add(key);
    cells.set(table.id, cell);
  }
  return cells;
}

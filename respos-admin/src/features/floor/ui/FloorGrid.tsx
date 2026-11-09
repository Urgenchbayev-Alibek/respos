import type { CSSProperties, ReactNode } from 'react';
import type { TableDto } from '@/entities/table/table.types';
import { resolveFloorCells } from '../model/floor-cells';
import styles from './FloorGrid.module.css';

export interface FloorGridProps {
  tables: TableDto[];
  renderTile: (table: TableDto) => ReactNode;
  label: string;
}

/**
 * Floor plan grid. `posX/posY` are grid cells (column/row, 0-based) when set;
 * tables without a position flow into the remaining cells.
 */
export function FloorGrid({ tables, renderTile, label }: FloorGridProps) {
  const cells = resolveFloorCells(tables);
  return (
    <ul className={styles.grid} aria-label={label}>
      {tables.map((table) => {
        const style: CSSProperties = {};
        const cell = cells?.get(table.id);
        if (cell && table.posX !== null && table.posX !== undefined) style.gridColumnStart = cell.column + 1;
        if (cell && table.posY !== null && table.posY !== undefined) style.gridRowStart = cell.row + 1;
        return (
          <li key={table.id} className={styles.cell} style={style}>
            {renderTile(table)}
          </li>
        );
      })}
    </ul>
  );
}

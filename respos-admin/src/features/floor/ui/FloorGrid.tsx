import type { CSSProperties, ReactNode } from 'react';
import type { TableDto } from '@/entities/table/table.types';
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
  return (
    <ul className={styles.grid} aria-label={label}>
      {tables.map((table) => {
        const style: CSSProperties = {};
        if (table.posX !== null && table.posX !== undefined) style.gridColumnStart = table.posX + 1;
        if (table.posY !== null && table.posY !== undefined) style.gridRowStart = table.posY + 1;
        return (
          <li key={table.id} className={styles.cell} style={style}>
            {renderTile(table)}
          </li>
        );
      })}
    </ul>
  );
}

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TableDto } from '@/entities/table/table.types';
import { resolveFloorCells } from '../model/floor-cells';
import { FloorGrid } from './FloorGrid';

const table = (id: string, posX: number | null, posY: number | null): TableDto => ({
  id,
  number: id,
  capacity: 4,
  areaId: 'area',
  areaName: 'Зал',
  status: 'available',
  isActive: true,
  posX,
  posY,
  activeOrderId: null,
  activeOrderTotal: null,
  nextReservation: null,
});

describe('resolveFloorCells', () => {
  it('uses grid cells when every position is a free cell in range', () => {
    const cells = resolveFloorCells([table('1', 0, 0), table('2', 1, 0), table('3', null, null)]);
    expect(cells?.get('2')).toEqual({ column: 1, row: 0 });
    expect(cells?.has('3')).toBe(false);
  });

  it('falls back to flow for two tables on the same cell (e.g. all areas shown together)', () => {
    expect(resolveFloorCells([table('1', 0, 0), table('7', 0, 0)])).toBeNull();
  });

  it('falls back to flow for pixel-like coordinates', () => {
    expect(resolveFloorCells([table('1', 40, 40), table('2', 160, 40)])).toBeNull();
  });
});

describe('FloorGrid', () => {
  it('flows colliding tiles in list order without explicit grid placement', () => {
    render(
      <FloorGrid
        label="План"
        tables={[table('b', 1, 0), table('a', 0, 0), table('c', 0, 0)]}
        renderTile={(t) => <span>{t.number}</span>}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(['b', 'a', 'c']);
    items.forEach((item) => expect(item.style.gridColumnStart).toBe(''));
  });
});

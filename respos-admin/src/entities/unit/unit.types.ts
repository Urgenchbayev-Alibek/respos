import type { Guid } from '@/shared/types/api-response';

export const UNIT_KINDS = ['mass', 'volume', 'count'] as const;
export type UnitKind = (typeof UNIT_KINDS)[number];

export interface UnitDto {
  id: Guid;
  code: string;
  name: string;
  kind: UnitKind;
}

export interface UnitInput {
  code: string;
  name: string;
  kind: UnitKind;
}

export interface UnitConversionInput {
  fromUnitId: string;
  toUnitId: string;
  factor: number;
}

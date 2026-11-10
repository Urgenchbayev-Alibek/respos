import { z } from 'zod';
import type { StockTransferDto, TransferInput } from '@/entities/stock-transfer/stock-transfer.types';
import { quantitySchema } from '@/shared/lib/quantity';
import { optionalString, V } from '@/shared/lib/validation';

export const transferSchema = z.object({
  toBranchId: z.string().min(1, V.required),
  comment: optionalString(500),
  lines: z
    .array(
      z.object({
        ingredientId: z.string().min(1, V.required),
        quantity: quantitySchema(),
        unitId: z.string().min(1, V.required),
      }),
    )
    .min(1, V.selectAtLeastOne),
});

export type TransferFormOutput = z.output<typeof transferSchema>;

export interface TransferLineValues {
  ingredientId: string;
  quantity: string;
  unitId: string;
}

export interface TransferFormValues {
  toBranchId: string;
  comment: string;
  lines: TransferLineValues[];
}

export const EMPTY_TRANSFER_LINE: TransferLineValues = {
  ingredientId: '',
  quantity: '',
  unitId: '',
};

export function toTransferFormValues(transfer: StockTransferDto | null | undefined): TransferFormValues {
  return {
    toBranchId: transfer?.toBranchId ?? '',
    comment: transfer?.comment ?? '',
    lines: transfer?.lines.length
      ? transfer.lines.map((line) => ({
          ingredientId: line.ingredientId,
          quantity: String(line.quantity),
          unitId: line.unitId,
        }))
      : [EMPTY_TRANSFER_LINE],
  };
}

export function toTransferInput(values: TransferFormOutput): TransferInput {
  return {
    toBranchId: values.toBranchId,
    comment: values.comment,
    lines: values.lines,
  };
}

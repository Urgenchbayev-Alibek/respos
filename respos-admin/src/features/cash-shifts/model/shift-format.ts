import type { AmountRow } from '../ui/ShiftAmounts';

export function differenceTone(difference: number | null | undefined): AmountRow['tone'] {
  if (!difference) return 'strong';
  return difference > 0 ? 'positive' : 'negative';
}

/** "+12 000 сўм" / "−5 000 сўм" for differences. */
export function formatSignedMoney(value: number | null | undefined, money: (amount: number) => string): string {
  if (value === null || value === undefined) return '—';
  return `${value > 0 ? '+' : ''}${money(value)}`;
}

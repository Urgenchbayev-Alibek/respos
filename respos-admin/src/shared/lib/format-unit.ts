import i18next from 'i18next';

/**
 * THE unit-of-measure display helper: maps a unit code (`kg`, `pcs`, …) to its localized
 * short label from `common:units`. Unknown (custom) codes are shown as-is.
 */
export function formatUnit(code: string | null | undefined): string {
  if (!code) return '';
  return i18next.t(`common:units.${code.toLowerCase()}`, { defaultValue: code });
}

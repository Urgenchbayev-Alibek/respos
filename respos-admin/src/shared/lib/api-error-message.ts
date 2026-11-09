import type { TFunction } from 'i18next';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { isApiError } from '@/shared/api/api-error';

/**
 * Localized message for any error. Server `code` (e.g. `auth.invalid_credentials`) maps to the
 * nested key `errors:auth.invalid_credentials`; unknown codes fall back to server `title`, then generic.
 */
export function getErrorMessage(error: unknown, t: TFunction): string {
  if (isApiError(error)) {
    const fallback = error.title || t('errors:unknown');
    return t(`errors:${error.code}`, { defaultValue: fallback });
  }
  return t('errors:unknown');
}

/**
 * Puts server field errors next to the fields (RHF). Returns true if at least one field matched,
 * so the caller can decide whether to also show a general error.
 */
export function applyServerFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): boolean {
  if (!isApiError(error)) return false;
  let matched = false;
  Object.entries(error.fieldErrors).forEach(([field, messages]) => {
    const target = fields.find((name) => name === field);
    if (target && messages[0]) {
      setError(target, { type: 'server', message: messages[0] });
      matched = true;
    }
  });
  return matched;
}

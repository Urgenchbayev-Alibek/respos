import type { TFunction } from 'i18next';
import { isApiError } from '@/shared/api/api-error';
import { getErrorMessage } from '@/shared/lib/api-error-message';

/**
 * F6 error codes (`time_entry.*`, `shift.*`, `pin.*`, `device.*`, `staff.*`) are translated in the `staff` namespace
 * (`staff:errors.<code>`); anything else falls back to the shared `errors:` mapping.
 */
export function staffErrorMessage(error: unknown, t: TFunction): string {
  const fallback = getErrorMessage(error, t);
  return isApiError(error) && error.code ? t(`staff:errors.${error.code}`, { defaultValue: fallback }) : fallback;
}

/** `125` → `2:05` (hours:minutes). */
export function formatMinutes(minutes: number): string {
  const sign = minutes < 0 ? '−' : '';
  const abs = Math.abs(Math.round(minutes));
  return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`;
}

export function initials(fullName: string): string {
  return (
    fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || '?'
  );
}

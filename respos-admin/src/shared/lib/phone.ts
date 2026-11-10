/**
 * The one phone normalization of the admin app, mirroring the server (`Restaurant.Domain.Common.PhoneNumbers`):
 * 9 local digits → +998…, 998 + 9 digits → +998…, other `+<8–15 digits>` kept; spaces, dashes, brackets allowed.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed || !/^\+?[\d\s\-()]+$/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, '');
  const international = trimmed.startsWith('+');
  if (!international && digits.length === 9) return `+998${digits}`;
  if (digits.startsWith('998')) return digits.length === 12 ? `+${digits}` : null;
  return international && digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
}

/** Uzbekistan number only (+998 and 9 digits) — guests (CRM) accept only these. */
export const isUzPhone = (input: string): boolean => normalizePhone(input)?.startsWith('+998') ?? false;

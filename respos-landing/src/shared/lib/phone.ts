const COUNTRY_CODE = '998';
const LOCAL_LENGTH = 9;

/** Extracts up to 9 local digits of an Uzbek number from any user input. */
export const extractLocalDigits = (input: string): string => {
  let digits = input.replace(/\D/g, '');
  // Strip the country code only when it is clearly present ("+998…" or more than 9 digits),
  // so a local number like "99 812-34-56" is not mangled.
  const hasCountryCode = input.trim().startsWith('+') || digits.length > LOCAL_LENGTH;
  if (hasCountryCode && digits.startsWith(COUNTRY_CODE)) digits = digits.slice(COUNTRY_CODE.length);
  return digits.slice(0, LOCAL_LENGTH);
};

/** Formats input as `+998 XX XXX-XX-XX` while the user types. */
export const formatUzPhone = (input: string): string => {
  const d = extractLocalDigits(input);
  if (d.length === 0) return '';
  let out = `+${COUNTRY_CODE} ${d.slice(0, 2)}`;
  if (d.length > 2) out += ` ${d.slice(2, 5)}`;
  if (d.length > 5) out += `-${d.slice(5, 7)}`;
  if (d.length > 7) out += `-${d.slice(7, 9)}`;
  return out;
};

export const isValidUzPhone = (input: string): boolean =>
  /^\+?[\d\s()-]+$/.test(input.trim()) && extractLocalDigits(input).length === LOCAL_LENGTH;

/** E.164 form sent to the API, e.g. `+998901234567`. */
export const toE164 = (input: string): string => `+${COUNTRY_CODE}${extractLocalDigits(input)}`;

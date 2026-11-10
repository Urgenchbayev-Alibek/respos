/** Prices in the organization currency, no fractional part for UZS: "45 000 сўм" / "45 000 so‘m". */
export function formatMoney(amount: number, currency: string, language: string): string {
  const locale = language === 'uz' ? 'uz-Latn-UZ' : 'ru-RU';
  const digits = currency === 'UZS' ? 0 : 2;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(amount);
  } catch {
    return `${amount.toFixed(digits)} ${currency}`;
  }
}

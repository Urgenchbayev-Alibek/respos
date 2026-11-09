import { useTranslation } from 'react-i18next';

/** Reads an array resource (e.g. bullet points) for the current language. */
export function useTList<T = string>(key: string): T[] {
  const { t } = useTranslation();
  const value: unknown = t(key, { returnObjects: true });
  return Array.isArray(value) ? (value as T[]) : [];
}

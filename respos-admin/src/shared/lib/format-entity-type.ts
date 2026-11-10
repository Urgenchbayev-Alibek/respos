import i18next from 'i18next';

/** Localized audit/system-event entity type (`Organization` → «Организация»); unknown types stay raw. */
export function formatEntityType(entityType: string | null | undefined): string {
  if (!entityType) return '';
  return i18next.t(`audit:entityTypes.${entityType}`, { defaultValue: entityType });
}

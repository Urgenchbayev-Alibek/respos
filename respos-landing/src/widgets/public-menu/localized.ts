/** Uzbek name when the UI is in Uzbek and the item has one; Russian otherwise. */
export function localized(entity: { name: string; nameUz: string | null }, language: string): string {
  return language === 'uz' && entity.nameUz ? entity.nameUz : entity.name;
}

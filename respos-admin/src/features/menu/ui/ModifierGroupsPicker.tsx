import { useTranslation } from 'react-i18next';
import type { ModifierGroupDto } from '@/entities/menu/menu.types';
import { Checkbox } from '@/shared/ui';
import styles from './MenuForms.module.css';

export interface ModifierGroupsPickerProps {
  groups: ModifierGroupDto[];
  value: string[];
  onChange: (ids: string[]) => void;
}

/** Links existing modifier groups to a menu item. */
export function ModifierGroupsPicker({ groups, value, onChange }: ModifierGroupsPickerProps) {
  const { t } = useTranslation('menu');
  const toggle = (id: string, checked: boolean) => onChange(checked ? [...value, id] : value.filter((current) => current !== id));

  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>{t('itemForm.modifierGroups')}</legend>
      {groups.length === 0 ? (
        <p className={styles.hint}>{t('itemForm.noModifierGroups')}</p>
      ) : (
        <div className={styles.checkGrid}>
          {groups.map((group) => (
            <Checkbox
              key={group.id}
              checked={value.includes(group.id)}
              onChange={(event) => toggle(group.id, event.target.checked)}
              label={group.name}
              description={t('modifiers.summary', {
                min: group.minSelect,
                max: group.maxSelect,
                options: group.options.length,
              })}
            />
          ))}
        </div>
      )}
    </fieldset>
  );
}

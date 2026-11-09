import { useTranslation } from 'react-i18next';
import { Checkbox } from '@/shared/ui';
import type { PermissionGroup } from '../model/group-permissions';
import styles from './PermissionChecklist.module.css';

export interface PermissionChecklistProps {
  groups: PermissionGroup[];
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}

/** Permission checklist grouped by module, with "select all" per module. */
export function PermissionChecklist({ groups, value, onChange, disabled }: PermissionChecklistProps) {
  const { t } = useTranslation('roles');
  const selected = new Set(value);

  const setMany = (codes: string[], checked: boolean) => {
    const next = new Set(selected);
    codes.forEach((code) => (checked ? next.add(code) : next.delete(code)));
    onChange([...next]);
  };

  return (
    <div className={styles.grid}>
      {groups.map((group) => {
        const codes = group.permissions.map((permission) => permission.code);
        const count = codes.filter((code) => selected.has(code)).length;
        return (
          <fieldset key={group.module} className={styles.group} disabled={disabled}>
            <legend className={styles.legend}>
              <Checkbox
                label={t(`modules.${group.module}`, { defaultValue: group.module })}
                checked={count === codes.length && codes.length > 0}
                indeterminate={count > 0 && count < codes.length}
                onChange={(event) => setMany(codes, event.target.checked)}
                aria-label={t('selectModule', { module: t(`modules.${group.module}`, { defaultValue: group.module }) })}
              />
              <span className={styles.count}>
                {count}/{codes.length}
              </span>
            </legend>
            <div className={styles.items}>
              {group.permissions.map((permission) => (
                <Checkbox
                  key={permission.code}
                  label={t(`codes.${permission.code.replace(/\./g, '_')}`, { defaultValue: permission.description || permission.code })}
                  description={permission.code}
                  checked={selected.has(permission.code)}
                  onChange={(event) => setMany([permission.code], event.target.checked)}
                />
              ))}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}

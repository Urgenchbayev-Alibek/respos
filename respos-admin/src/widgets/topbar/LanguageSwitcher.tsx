import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, type Language } from '@/shared/constants/locale';
import { changeLanguage } from '@/shared/i18n';
import { DropdownMenu } from '@/shared/ui';
import styles from './TopbarTrigger.module.css';

/** RU / UZ / EN switch (choice is remembered on this device). */
export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  return (
    <DropdownMenu
      items={LANGUAGES.map((lang: Language) => ({
        id: lang,
        label: t(`common:languages.${lang}`),
        selected: i18n.language === lang,
        onSelect: () => void changeLanguage(lang),
      }))}
      trigger={(props) => (
        <button type="button" className={styles.trigger} aria-label={t('nav:topbar.language')} {...props}>
          <Languages aria-hidden="true" />
          <span className={styles.label}>{i18n.language.toUpperCase()}</span>
        </button>
      )}
    />
  );
}

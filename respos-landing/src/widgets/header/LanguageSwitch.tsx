import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/shared/i18n';
import { cx } from '@/shared/lib/cx';
import styles from './LanguageSwitch.module.css';

const LABELS: Record<SupportedLanguage, { short: string; full: string; htmlLang: string }> = {
  ru: { short: 'RU', full: 'Русский', htmlLang: 'ru' },
  uz: { short: 'UZ', full: 'Oʻzbekcha', htmlLang: 'uz-Latn' },
};

interface LanguageSwitchProps {
  className?: string;
}

export function LanguageSwitch({ className }: LanguageSwitchProps) {
  const { t, i18n } = useTranslation();
  const current = i18n.resolvedLanguage ?? i18n.language;

  return (
    <div className={cx(styles.switch, className)} role="group" aria-label={t('nav.language')}>
      {SUPPORTED_LANGUAGES.map((lng) => {
        const active = current === lng;
        return (
          <button
            key={lng}
            type="button"
            lang={LABELS[lng].htmlLang}
            className={cx(styles.option, active && styles.active)}
            aria-pressed={active}
            title={LABELS[lng].full}
            onClick={() => void i18n.changeLanguage(lng)}
          >
            <span aria-hidden="true">{LABELS[lng].short}</span>
            <span className="visually-hidden">{LABELS[lng].full}</span>
          </button>
        );
      })}
    </div>
  );
}

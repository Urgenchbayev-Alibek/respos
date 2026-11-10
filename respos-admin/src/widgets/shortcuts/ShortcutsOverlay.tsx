import { Keyboard } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRegisteredShortcuts, useShortcuts } from '@/shared/hooks/use-shortcuts';
import { IconButton, Modal } from '@/shared/ui';
import styles from './ShortcutsOverlay.module.css';

const HELP_KEY = '?';

/** `?` (or the keyboard button) opens the list of shortcuts active on the current screen. */
export function ShortcutsOverlay() {
  const { t } = useTranslation('ux');
  const [open, setOpen] = useState(false);
  const registered = useRegisteredShortcuts();
  const shortcuts = registered.filter((shortcut) => shortcut.keys !== HELP_KEY);
  useShortcuts([{ keys: HELP_KEY, label: t('shortcuts.toggleHelp'), handler: () => setOpen(true) }]);

  if (shortcuts.length === 0) return null;
  return (
    <>
      <IconButton label={t('shortcuts.title')} icon={<Keyboard />} aria-keyshortcuts="?" onClick={() => setOpen(true)} />
      <Modal open={open} onClose={() => setOpen(false)} title={t('shortcuts.title')} description={t('shortcuts.description')} size="sm">
        <dl className={styles.list}>
          {[...shortcuts, { keys: HELP_KEY, label: t('shortcuts.toggleHelp') }].map((shortcut) => (
            <div key={`${shortcut.keys}-${shortcut.label}`} className={styles.row}>
              <dt>
                {shortcut.keys.split('+').map((key, index) => (
                  <kbd key={`${key}-${index}`} className={styles.kbd}>
                    {key}
                  </kbd>
                ))}
              </dt>
              <dd>{shortcut.label}</dd>
            </div>
          ))}
        </dl>
      </Modal>
    </>
  );
}

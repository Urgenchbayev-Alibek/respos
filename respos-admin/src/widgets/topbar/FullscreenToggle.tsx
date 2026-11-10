import { Maximize, Minimize } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFullscreen } from '@/shared/hooks/use-fullscreen';
import { IconButton } from '@/shared/ui';

/** Topbar button: enter/exit fullscreen (hidden where the Fullscreen API is unavailable, e.g. iOS Safari). */
export function FullscreenToggle({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const { t } = useTranslation('ux');
  const { supported, fullscreen, toggle } = useFullscreen();
  if (!supported) return null;
  return (
    <IconButton
      size={size}
      label={fullscreen ? t('fullscreen.exit') : t('fullscreen.enter')}
      icon={fullscreen ? <Minimize /> : <Maximize />}
      aria-pressed={fullscreen}
      onClick={toggle}
    />
  );
}

import { Volume2, VolumeX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { KitchenStationDto } from '@/entities/kitchen-station/kitchen-station.types';
import { ALL_STATIONS } from '../model/kds-preferences';
import styles from './KitchenToolbar.module.css';

export type KitchenView = 'active' | 'served';

interface KitchenToolbarProps {
  stations: KitchenStationDto[];
  station: string;
  onStationChange: (stationId: string) => void;
  view: KitchenView;
  onViewChange: (view: KitchenView) => void;
  soundOn: boolean;
  onToggleSound: () => void;
}

export function KitchenToolbar(props: KitchenToolbarProps) {
  const { stations, station, onStationChange, view, onViewChange, soundOn, onToggleSound } = props;
  const { t } = useTranslation('kitchen');
  const stationButton = (id: string, label: string) => (
    <button key={id} type="button" className={styles.toggle} aria-pressed={station === id} onClick={() => onStationChange(id)}>
      {label}
    </button>
  );

  return (
    <div className={styles.toolbar}>
      <div className={`${styles.group} ${styles.stations}`} role="group" aria-label={t('toolbar.stations')}>
        {stationButton(ALL_STATIONS, t('toolbar.allStations'))}
        {stations.map((item) => stationButton(item.id, item.name))}
      </div>
      <div className={styles.group} role="group" aria-label={t('toolbar.view')}>
        {(['active', 'served'] as const).map((id) => (
          <button key={id} type="button" className={styles.toggle} aria-pressed={view === id} onClick={() => onViewChange(id)}>
            {t(`toolbar.views.${id}`)}
          </button>
        ))}
      </div>
      <button type="button" className={`${styles.toggle} ${styles.sound}`} aria-pressed={soundOn} onClick={onToggleSound}>
        {soundOn ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
        {t(soundOn ? 'toolbar.soundOn' : 'toolbar.soundOff')}
      </button>
    </div>
  );
}

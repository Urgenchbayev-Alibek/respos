import { useQueryClient } from '@tanstack/react-query';
import { ChefHat } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  kitchenTicketKeys,
  useKitchenStations,
  useKitchenTickets,
  useTicketAction,
  useTicketItemAction,
} from '@/entities/kitchen-ticket/kitchen-ticket.queries';
import type {
  KitchenTicketDto,
  KitchenTicketItemDto,
  KitchenTicketParams,
  TicketAction,
  TicketItemAction,
} from '@/entities/kitchen-ticket/kitchen-ticket.types';
import { ALL_STATIONS, useStoredStation } from '@/features/kitchen/model/kds-preferences';
import { playChime, unlockChime } from '@/features/kitchen/model/kitchen-chime';
import { useKitchenStationGroup } from '@/features/kitchen/model/use-kitchen-station-group';
import { useNewTicketAlerts } from '@/features/kitchen/model/use-new-ticket-alerts';
import { useNow } from '@/features/kitchen/model/use-now';
import { KitchenBoard } from '@/features/kitchen/ui/KitchenBoard';
import { KitchenToolbar, type KitchenView } from '@/features/kitchen/ui/KitchenToolbar';
import { OfflineBanner } from '@/features/kitchen/ui/OfflineBanner';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { useCurrentBranch } from '@/shared/hooks/use-current-branch';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { useRealtimeEvent, useRealtimeStatus } from '@/shared/realtime';
import { EmptyState, ErrorState, PageLoader, useToast } from '@/shared/ui';

const ACTIVE_STATUSES = ['new', 'in_progress', 'ready'] as const;
const SERVED_STATUSES = ['served'] as const;

/** Kitchen Display System: tickets by station, live via SignalR hints + REST refetch. */
export function KitchenBoardPage() {
  const { t } = useTranslation('kitchen');
  const toast = useToast();
  const queryClient = useQueryClient();
  const { branch } = useCurrentBranch();
  const { hasPermission } = usePermissions();
  const connection = useRealtimeStatus();
  const now = useNow();
  const [storedStation, setStation] = useStoredStation();
  const [view, setView] = useState<KitchenView>('active');
  const [soundOn, setSoundOn] = useState(false);

  const stationsQuery = useKitchenStations();
  const stations = useMemo(
    () => (stationsQuery.data ?? []).filter((s) => s.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    [stationsQuery.data],
  );
  const stationId = stations.some((s) => s.id === storedStation) ? storedStation : undefined;
  const selected = stationId ?? ALL_STATIONS;

  const params = useMemo<KitchenTicketParams>(
    () => ({ stationId, status: view === 'active' ? ACTIVE_STATUSES : SERVED_STATUSES }),
    [stationId, view],
  );
  const tickets = useKitchenTickets(params, { poll: connection !== 'connected' });
  useKitchenStationGroup(branch?.id ?? null, stationId ?? null);

  const refetch = () => void queryClient.invalidateQueries({ queryKey: kitchenTicketKeys.all });
  useRealtimeEvent('KitchenTicketCreated', refetch);
  useRealtimeEvent('KitchenTicketUpdated', refetch);

  const highlighted = useNewTicketAlerts(view === 'active' ? tickets.data : undefined, `${selected}|${view}`, () => {
    if (soundOn) playChime();
  });

  const ticketAction = useTicketAction();
  const itemAction = useTicketItemAction();
  const onError = (error: unknown) => toast.error(t('actionFailed'), getErrorMessage(error, t));
  const onAction = (ticket: KitchenTicketDto, action: TicketAction) =>
    ticketAction.mutate({ ticketId: ticket.id, action }, { onError });
  const onItemAction = (item: KitchenTicketItemDto, action: TicketItemAction) =>
    itemAction.mutate({ itemId: item.id, action }, { onError });
  const isPending = (ticket: KitchenTicketDto) =>
    (ticketAction.isPending && ticketAction.variables.ticketId === ticket.id) ||
    (itemAction.isPending && ticket.items.some((item) => item.id === itemAction.variables.itemId));

  const toggleSound = async () => {
    if (soundOn) {
      setSoundOn(false);
      return;
    }
    if (await unlockChime()) {
      setSoundOn(true);
      playChime();
    } else {
      toast.error(t('soundUnavailable'));
    }
  };

  return (
    <>
      <h2 className="visually-hidden">{t('title')}</h2>
      <OfflineBanner state={connection} />
      <KitchenToolbar
        stations={stations}
        station={selected}
        onStationChange={setStation}
        view={view}
        onViewChange={setView}
        soundOn={soundOn}
        onToggleSound={() => void toggleSound()}
      />
      {tickets.isPending ? (
        <PageLoader />
      ) : tickets.isError && !tickets.data ? (
        <ErrorState error={tickets.error} onRetry={() => void tickets.refetch()} />
      ) : tickets.data.length === 0 ? (
        <EmptyState icon={<ChefHat />} title={t(view === 'active' ? 'empty' : 'emptyServed')} />
      ) : (
        <KitchenBoard
          tickets={tickets.data}
          layout={view === 'active' ? 'columns' : 'served'}
          highlighted={highlighted}
          isPending={isPending}
          now={now}
          canUpdate={hasPermission(PERMISSIONS.kitchen.statusUpdate)}
          onAction={onAction}
          onItemAction={onItemAction}
        />
      )}
    </>
  );
}

import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSchedule, useStaffMembers } from '@/entities/staff/staff.queries';
import type { ShiftDto } from '@/entities/staff/staff.types';
import { formatMinutes } from '@/features/staff/model/staff-errors';
import { ShiftFormModal } from '@/features/staff/ui/ShiftFormModal';
import { useCurrentBranch } from '@/shared/hooks/use-current-branch';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { toBranchDateString } from '@/shared/lib/format-date';
import { addDaysToDateString } from '@/shared/lib/zoned-time';
import { Button, EmptyState, ErrorState, IconButton, PageHeader, Skeleton, Toolbar } from '@/shared/ui';
import styles from './SchedulePage.module.css';
import { StaffTabs } from './StaffTabs';
import { weekDays, weekStart } from './week';

type Editing = { shift: ShiftDto | null; initial?: { userId: string; date: string } } | null;

/** Admin → Staff → weekly schedule grid (employees × days). Click a cell to add a shift, a shift to edit it. */
export function SchedulePage() {
  const { t } = useTranslation('staff');
  const format = useFormatters();
  const { branch } = useCurrentBranch();
  const [start, setStart] = useState(() => weekStart(toBranchDateString(new Date(), branch?.timezone)));
  const days = weekDays(start);
  const range = { from: start, to: days[6] ?? start };
  const schedule = useSchedule(range);
  const members = useStaffMembers();
  const [editing, setEditing] = useState<Editing>(null);

  const shiftsOf = (userId: string, date: string) =>
    (schedule.data ?? []).filter((shift) => shift.userId === userId && shift.date === date);
  const plannedOf = (userId: string) =>
    (schedule.data ?? []).filter((shift) => shift.userId === userId).reduce((sum, shift) => sum + shift.plannedMinutes, 0);

  return (
    <>
      <PageHeader
        title={t('nav.title')}
        description={t('schedule.subtitle')}
        actions={
          <Button variant="primary" icon={<Plus />} onClick={() => setEditing({ shift: null })}>
            {t('schedule.add')}
          </Button>
        }
      />
      <StaffTabs />
      <Toolbar>
        <IconButton label={t('schedule.prevWeek')} icon={<ChevronLeft />} onClick={() => setStart(addDaysToDateString(start, -7))} />
        <strong>
          {format.date(`${range.from}T12:00:00Z`)} – {format.date(`${range.to}T12:00:00Z`)}
        </strong>
        <IconButton label={t('schedule.nextWeek')} icon={<ChevronRight />} onClick={() => setStart(addDaysToDateString(start, 7))} />
      </Toolbar>
      {(schedule.isLoading || members.isLoading) && <Skeleton height={240} />}
      {(schedule.isError || members.isError) && (
        <ErrorState error={schedule.error ?? members.error} onRetry={() => void Promise.all([schedule.refetch(), members.refetch()])} />
      )}
      {members.data?.length === 0 && <EmptyState title={t('schedule.noMembers')} />}
      {members.data && members.data.length > 0 && schedule.data && (
        <div className={styles.scroll}>
          <table className={styles.grid}>
            <caption className={styles.caption}>{t('tabs.schedule')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('fields.employee')}</th>
                {days.map((day) => (
                  <th key={day} scope="col">
                    {t(`schedule.weekday.${days.indexOf(day)}`)} {day.slice(8)}.{day.slice(5, 7)}
                  </th>
                ))}
                <th scope="col">{t('fields.planned')}</th>
              </tr>
            </thead>
            <tbody>
              {members.data.map((member) => (
                <tr key={member.userId}>
                  <th scope="row">{member.fullName}</th>
                  {days.map((day) => (
                    <td key={day}>
                      {shiftsOf(member.userId, day).map((shift) => (
                        <button key={shift.id} type="button" className={styles.shift} onClick={() => setEditing({ shift })}>
                          {shift.startTime}–{shift.endTime}
                          {shift.roleNote && <span className={styles.role}>{shift.roleNote}</span>}
                        </button>
                      ))}
                      <button
                        type="button"
                        className={styles.add}
                        aria-label={t('schedule.addFor', { name: member.fullName, date: day })}
                        onClick={() => setEditing({ shift: null, initial: { userId: member.userId, date: day } })}
                      >
                        +
                      </button>
                    </td>
                  ))}
                  <td>{formatMinutes(plannedOf(member.userId))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <ShiftFormModal shift={editing.shift} initial={editing.initial} members={members.data ?? []} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

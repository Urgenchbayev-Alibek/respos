import type { ModifierGroupDto } from '@/entities/menu/menu.types';

/** Selected option ids per modifier group. */
export type ModifierSelection = Record<string, string[]>;

export type GroupError = { kind: 'min'; min: number } | { kind: 'max'; max: number };

/** Required groups need at least one choice even if minSelect is 0. */
export function minFor(group: ModifierGroupDto): number {
  return group.isRequired ? Math.max(1, group.minSelect) : Math.max(0, group.minSelect);
}

/** maxSelect ≤ 0 is treated as "no limit". */
export function maxFor(group: ModifierGroupDto): number {
  return group.maxSelect > 0 ? group.maxSelect : group.options.length;
}

/** UX pre-check before adding to the cart; the server validates again on `POST /orders/{id}/items`. */
export function validateSelection(groups: ModifierGroupDto[], selection: ModifierSelection): Record<string, GroupError> {
  const errors: Record<string, GroupError> = {};
  groups.forEach((group) => {
    const count = selection[group.id]?.length ?? 0;
    const min = minFor(group);
    const max = maxFor(group);
    if (count < min) errors[group.id] = { kind: 'min', min };
    else if (count > max) errors[group.id] = { kind: 'max', max };
  });
  return errors;
}

/** Toggle an option respecting the group max: single-choice groups swap the choice. */
export function toggleOption(group: ModifierGroupDto, selection: ModifierSelection, optionId: string): ModifierSelection {
  const current = selection[group.id] ?? [];
  if (current.includes(optionId)) return { ...selection, [group.id]: current.filter((id) => id !== optionId) };
  const max = maxFor(group);
  if (max === 1) return { ...selection, [group.id]: [optionId] };
  if (current.length >= max) return selection;
  return { ...selection, [group.id]: [...current, optionId] };
}

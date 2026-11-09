import { Archive, ArrowLeftRight, Gauge, MoreHorizontal, Pencil } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useArchiveIngredient } from '@/entities/ingredient/ingredient.queries';
import type { IngredientDto } from '@/entities/ingredient/ingredient.types';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { ConfirmDialog, DropdownMenu, IconButton, useToast, type DropdownMenuItem } from '@/shared/ui';

export interface IngredientRowActionsProps {
  ingredient: IngredientDto;
  onMovement: (ingredient: IngredientDto) => void;
  onMinQuantity: (ingredient: IngredientDto) => void;
  onEdit: (ingredient: IngredientDto) => void;
}

export function IngredientRowActions({ ingredient, onMovement, onMinQuantity, onEdit }: IngredientRowActionsProps) {
  const { t } = useTranslation('stock');
  const toast = useToast();
  const { hasPermission } = usePermissions();
  const archive = useArchiveIngredient();
  const [confirming, setConfirming] = useState(false);

  const items: DropdownMenuItem[] = [];
  if (hasPermission(PERMISSIONS.inventory.adjust) && !ingredient.isArchived) {
    items.push({ id: 'movement', label: t('actions.movement'), icon: <ArrowLeftRight />, onSelect: () => onMovement(ingredient) });
  }
  if (hasPermission(PERMISSIONS.inventory.manage)) {
    items.push({ id: 'min', label: t('actions.minQuantity'), icon: <Gauge />, onSelect: () => onMinQuantity(ingredient) });
    items.push({ id: 'edit', label: t('actions.edit'), icon: <Pencil />, onSelect: () => onEdit(ingredient) });
    if (!ingredient.isArchived) {
      items.push({ id: 'archive', label: t('actions.archive'), icon: <Archive />, danger: true, onSelect: () => setConfirming(true) });
    }
  }
  if (items.length === 0) return null;

  const confirm = async () => {
    try {
      await archive.mutateAsync(ingredient.id);
      toast.success(t('ingredients.archived'));
    } catch (error) {
      toast.error(t('ingredients.archiveFailed'), getErrorMessage(error, t));
    } finally {
      setConfirming(false);
    }
  };

  return (
    <span onClick={(event) => event.stopPropagation()}>
      <DropdownMenu
        items={items}
        trigger={(props) => <IconButton label={t('actions.menu', { name: ingredient.name })} icon={<MoreHorizontal />} {...props} />}
      />
      <ConfirmDialog
        open={confirming}
        title={t('ingredients.archiveTitle')}
        message={t('ingredients.archiveMessage', { name: ingredient.name })}
        confirmLabel={t('actions.archive')}
        loading={archive.isPending}
        onConfirm={() => void confirm()}
        onCancel={() => setConfirming(false)}
      />
    </span>
  );
}

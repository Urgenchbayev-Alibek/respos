import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm, type Resolver } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useIngredientOptions } from '@/entities/ingredient/ingredient.queries';
import { useSaveRecipe } from '@/entities/recipe/recipe.queries';
import type { RecipeDto } from '@/entities/recipe/recipe.types';
import { unitOptions, useUnits } from '@/entities/unit/unit.queries';
import styles from '@/features/stock/ui/stock.module.css';
import { PERMISSIONS } from '@/shared/constants/permissions';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { getErrorMessage } from '@/shared/lib/api-error-message';
import { quantitySchema } from '@/shared/lib/quantity';
import { V } from '@/shared/lib/validation';
import { Alert, Button, FormField, IconButton, Input, Select, useToast } from '@/shared/ui';

const schema = z.object({
  lines: z
    .array(z.object({ ingredientId: z.string().min(1, V.required), quantity: quantitySchema(), unitId: z.string().min(1, V.required) }))
    .min(1, 'errors:recipe.empty'),
});
type Output = z.output<typeof schema>;
interface Values {
  lines: { ingredientId: string; quantity: string; unitId: string }[];
}

const EMPTY_LINE = { ingredientId: '', quantity: '', unitId: '' };

function toValues(recipe: RecipeDto | null | undefined): Values {
  return {
    lines: recipe?.ingredients.length
      ? recipe.ingredients.map((line) => ({ ingredientId: line.ingredientId, quantity: String(line.quantity), unitId: line.unitId }))
      : [EMPTY_LINE],
  };
}

export interface RecipeEditorProps {
  menuItemId: string;
  variantId: string | null;
  /** Active version for this item/variant (null = no recipe yet). */
  recipe: RecipeDto | null;
}

/** Ingredient lines per portion. Saving always creates a NEW version (history is kept). */
export function RecipeEditor({ menuItemId, variantId, recipe }: RecipeEditorProps) {
  const { t } = useTranslation('recipes');
  const toast = useToast();
  const format = useFormatters();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission(PERMISSIONS.recipes.manage);
  const ingredients = useIngredientOptions(canManage);
  const units = useUnits();
  const save = useSaveRecipe();
  const [serverError, setServerError] = useState<string | null>(null);
  const { control, register, handleSubmit, reset, formState } = useForm<Values, unknown, Output>({
    resolver: zodResolver(schema) as unknown as Resolver<Values>,
    defaultValues: toValues(recipe),
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });

  useEffect(() => {
    reset(toValues(recipe));
    setServerError(null);
  }, [recipe, menuItemId, variantId, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await save.mutateAsync({ menuItemId, variantId, ingredients: values.lines });
      toast.success(t('saved'));
    } catch (error) {
      setServerError(getErrorMessage(error, t));
    }
  });

  const ingredientOptions = canManage
    ? (ingredients.data?.items ?? []).filter((item) => !item.isArchived).map((item) => ({ value: item.id, label: item.name }))
    : (recipe?.ingredients ?? []).map((line) => ({ value: line.ingredientId, label: line.ingredientName }));
  const linesError = formState.errors.lines?.message ?? formState.errors.lines?.root?.message;

  return (
    <form noValidate onSubmit={onSubmit} className={styles.stack} aria-label={t('editorLabel')}>
      {!recipe && <Alert>{t('noRecipeWarning')}</Alert>}
      {serverError && <Alert>{serverError}</Alert>}
      <div className={styles.linesScroll}>
        <table className={styles.linesTable}>
          <thead>
            <tr>
              <th scope="col">{t('columns.ingredient')}</th>
              <th scope="col">{t('columns.quantity')}</th>
              <th scope="col">{t('columns.unit')}</th>
              <th scope="col"><span className="visually-hidden">{t('columns.actions')}</span></th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => {
              const errors = formState.errors.lines?.[index];
              return (
                <tr key={field.id}>
                  <td>
                    <FormField label={<span className="visually-hidden">{t('columns.ingredient')}</span>} error={errors?.ingredientId?.message}>
                      <Select placeholder={t('selectIngredient')} disabled={!canManage} options={ingredientOptions} {...register(`lines.${index}.ingredientId`)} />
                    </FormField>
                  </td>
                  <td>
                    <FormField label={<span className="visually-hidden">{t('columns.quantity')}</span>} error={errors?.quantity?.message}>
                      <Input className={styles.lineInput} inputMode="decimal" disabled={!canManage} {...register(`lines.${index}.quantity`)} />
                    </FormField>
                  </td>
                  <td>
                    <FormField label={<span className="visually-hidden">{t('columns.unit')}</span>} error={errors?.unitId?.message}>
                      <Select placeholder="—" disabled={!canManage} options={unitOptions(units.data)} {...register(`lines.${index}.unitId`)} />
                    </FormField>
                  </td>
                  <td>
                    {canManage && (
                      <IconButton label={t('removeLine')} icon={<Trash2 />} onClick={() => remove(index)} disabled={fields.length === 1} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {linesError && <Alert>{t(linesError)}</Alert>}
      <div className={styles.row}>
        {canManage && (
          <Button icon={<Plus />} onClick={() => append(EMPTY_LINE)}>
            {t('addLine')}
          </Button>
        )}
        <span className={styles.muted}>
          {t('estimatedCost')}: <strong>{format.money(recipe?.estimatedCost)}</strong>
        </span>
      </div>
      {canManage && (
        <div className={styles.row}>
          <Button variant="primary" type="submit" loading={formState.isSubmitting}>
            {t('saveAsVersion', { version: (recipe?.version ?? 0) + 1 })}
          </Button>
        </div>
      )}
    </form>
  );
}

import { z } from 'zod';
import type { MenuItemDto, MenuItemInput, ModifierGroupDto, ModifierGroupInput } from '@/entities/menu/menu.types';
import { optionalString, requiredString, V } from '@/shared/lib/validation';

export const MENU_V = {
  prepTime: 'menu:validation.prepTime',
  oneDefault: 'menu:validation.oneDefault',
  selectRange: 'menu:validation.selectRange',
  minSelect: 'menu:validation.minSelect',
  optionsRequired: 'menu:validation.optionsRequired',
  priceDelta: 'menu:validation.priceDelta',
} as const;

const TWO_DECIMALS = (value: number) => Math.round(value * 100) === value * 100;

/** Required money from <MoneyInput> (number | null): null → "required". */
export const priceSchema = z
  .number({ invalid_type_error: V.required, required_error: V.required })
  .min(0, V.nonNegative)
  .refine(TWO_DECIMALS, V.moneyPrecision);

const variantSchema = z.object({
  id: z.string().optional(),
  name: requiredString(100),
  price: priceSchema,
  isDefault: z.boolean(),
});

export const menuItemSchema = z
  .object({
    name: requiredString(150),
    nameUz: optionalString(150),
    description: optionalString(1000),
    sku: optionalString(50),
    categoryId: z.string().min(1, V.required),
    price: priceSchema,
    prepTimeMinutes: z
      .string()
      .trim()
      .regex(/^\d{0,3}$/, MENU_V.prepTime)
      .transform((value) => (value === '' ? 0 : Number(value))),
    kitchenStationId: z.string(),
    isAvailable: z.boolean(),
    variants: z.array(variantSchema),
    modifierGroupIds: z.array(z.string()),
  })
  .superRefine((values, ctx) => {
    if (values.variants.length > 0 && values.variants.filter((variant) => variant.isDefault).length !== 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['variants'], message: MENU_V.oneDefault });
    }
  });

export type MenuItemFormValues = z.input<typeof menuItemSchema>;
export type MenuItemFormOutput = z.output<typeof menuItemSchema>;

export function toMenuItemFormValues(item: MenuItemDto | null, defaultCategoryId: string): MenuItemFormValues {
  return {
    name: item?.name ?? '',
    nameUz: item?.nameUz ?? '',
    description: item?.description ?? '',
    sku: item?.sku ?? '',
    categoryId: item?.categoryId ?? defaultCategoryId,
    price: item ? item.price : (null as unknown as number),
    prepTimeMinutes: item?.prepTimeMinutes ? String(item.prepTimeMinutes) : '',
    kitchenStationId: item?.kitchenStationId ?? '',
    isAvailable: item?.isAvailable ?? true,
    variants: (item?.variants ?? []).map((variant) => ({ ...variant })),
    modifierGroupIds: (item?.modifierGroups ?? []).map((group) => group.id),
  };
}

export function toMenuItemInput(values: MenuItemFormOutput): MenuItemInput {
  return { ...values, kitchenStationId: values.kitchenStationId || null };
}

const optionSchema = z.object({
  id: z.string().optional(),
  name: requiredString(100),
  priceDelta: z
    .number({ invalid_type_error: MENU_V.priceDelta, required_error: MENU_V.priceDelta })
    .refine(TWO_DECIMALS, V.moneyPrecision),
});

const countSchema = z.coerce
  .number({ invalid_type_error: MENU_V.selectRange })
  .int(MENU_V.selectRange)
  .min(0, MENU_V.selectRange)
  .max(50, MENU_V.selectRange);

export const modifierGroupSchema = z
  .object({
    name: requiredString(100),
    minSelect: countSchema,
    maxSelect: countSchema,
    isRequired: z.boolean(),
    options: z.array(optionSchema).min(1, MENU_V.optionsRequired),
  })
  .superRefine((values, ctx) => {
    if (values.maxSelect < Math.max(1, values.minSelect)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['maxSelect'], message: MENU_V.selectRange });
    }
    if (values.isRequired && values.minSelect < 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['minSelect'], message: MENU_V.minSelect });
    }
  });

export type ModifierGroupFormValues = z.input<typeof modifierGroupSchema>;
export type ModifierGroupFormOutput = z.output<typeof modifierGroupSchema>;

export function toModifierGroupFormValues(group: ModifierGroupDto | null): ModifierGroupFormValues {
  return {
    name: group?.name ?? '',
    minSelect: group?.minSelect ?? 0,
    maxSelect: group?.maxSelect ?? 1,
    isRequired: group?.isRequired ?? false,
    options: (group?.options ?? [{ name: '', priceDelta: 0 }]).map((option) => ({ ...option })),
  };
}

export function toModifierGroupInput(values: ModifierGroupFormOutput): ModifierGroupInput {
  return values;
}

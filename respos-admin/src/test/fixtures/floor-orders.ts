import type { MenuItemDto, PosCategoryDto } from '@/entities/menu/menu.types';
import type { OrderDto, OrderItemDto } from '@/entities/order/order.types';
import type { TableDto } from '@/entities/table/table.types';

/** Shared test data for floor / menu / order tests. Shapes mirror the real backend DTOs. */
export function makeTable(overrides: Partial<TableDto> = {}): TableDto {
  return {
    id: 't1',
    number: '7',
    capacity: 4,
    areaId: 'a1',
    areaName: 'Основной',
    status: 'available',
    isActive: true,
    posX: null,
    posY: null,
    activeOrderId: null,
    activeOrderTotal: null,
    nextReservation: null,
    ...overrides,
  };
}

export function makeMenuItem(overrides: Partial<MenuItemDto> = {}): MenuItemDto {
  return {
    id: 'm1',
    categoryId: 'c1',
    categoryName: 'Горячее',
    name: 'Плов',
    nameUz: 'Osh',
    description: null,
    photoUrl: null,
    price: 45000,
    prepTimeMinutes: 15,
    kitchenStationId: null,
    isAvailable: true,
    isArchived: false,
    sku: null,
    variants: [],
    modifierGroups: [],
    availability: [],
    ...overrides,
  };
}

export function makePosMenu(items: MenuItemDto[] = [makeMenuItem()]): PosCategoryDto[] {
  return [{ id: 'c1', name: 'Горячее', nameUz: 'Issiq', sortOrder: 1, items }];
}

export function makeOrderItem(overrides: Partial<OrderItemDto> = {}): OrderItemDto {
  return {
    id: 'i1',
    menuItemId: 'm1',
    variantId: null,
    name: 'Плов',
    variantName: null,
    unitPrice: 45000,
    quantity: 2,
    modifiers: [],
    comment: null,
    status: 'new',
    lineTotal: 90000,
    stationId: null,
    sentAt: null,
    readyAt: null,
    cancelReason: null,
    ...overrides,
  };
}

export function makeOrder(overrides: Partial<OrderDto> = {}): OrderDto {
  return {
    id: 'o1',
    number: 42,
    businessDate: '2026-11-10',
    type: 'dine_in',
    status: 'draft',
    tableId: 't1',
    tableNumber: '7',
    waiterId: '00000000-0000-0000-0000-000000000001',
    waiterName: 'Азиз',
    guestCount: 2,
    total: 90000,
    paidAmount: 0,
    openedAt: '2026-11-10T07:00:00Z',
    closedAt: null,
    items: [makeOrderItem()],
    subtotal: 90000,
    discountType: 'none',
    discountValue: 0,
    discountAmount: 0,
    serviceChargeAmount: 0,
    taxAmount: 0,
    remainingAmount: 90000,
    comment: null,
    cancelReason: null,
    payments: [],
    history: [],
    ...overrides,
  };
}

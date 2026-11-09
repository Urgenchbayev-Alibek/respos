import { defineRoutes, lazyPage } from '@/app/router/route-module';
import { PERMISSIONS as P } from '@/shared/constants/permissions';
import { ROUTES } from '@/shared/constants/routes';

/** Stock workspace reuses the same page components as the admin Inventory/Recipes/Suppliers/Purchases sections. */
export const routeModule = defineRoutes('stock', [
  {
    index: true,
    element: lazyPage(() => import('@/pages/stock/inventory/InventoryPage').then((m) => ({ default: m.InventoryPage })), {
      anyOf: [P.inventory.read],
    }),
  },
  {
    path: ROUTES.stock.counts,
    element: lazyPage(() => import('@/pages/stock/inventory/InventoryPage').then((m) => ({ default: m.StockCountsPage })), {
      anyOf: [P.inventory.adjust],
    }),
  },
  {
    path: ROUTES.stock.purchases,
    element: lazyPage(() => import('@/pages/stock/purchases/PurchasesPage').then((m) => ({ default: m.PurchasesPage })), {
      anyOf: [P.purchases.read],
    }),
  },
  {
    path: ROUTES.stock.purchaseDetail,
    element: lazyPage(
      () => import('@/pages/stock/purchases/PurchaseDetailPage').then((m) => ({ default: m.PurchaseDetailPage })),
      { anyOf: [P.purchases.read] },
    ),
  },
  {
    path: ROUTES.stock.suppliers,
    element: lazyPage(() => import('@/pages/stock/suppliers/SuppliersPage').then((m) => ({ default: m.SuppliersPage })), {
      anyOf: [P.suppliers.read],
    }),
  },
  {
    path: ROUTES.stock.recipes,
    element: lazyPage(() => import('@/pages/stock/recipes/RecipesPage').then((m) => ({ default: m.RecipesPage })), {
      anyOf: [P.recipes.read],
    }),
  },
]);

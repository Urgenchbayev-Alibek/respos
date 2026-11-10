# respos-admin — RestaurantOS work interfaces

One React app with all staff workspaces, each with its own layout and routes:

| Workspace | Path | Layout | Access (UX only — backend enforces) |
|---|---|---|---|
| Admin Panel | `/admin/*` | `AdminLayout` (sidebar → drawer on tablet/mobile) | management perms (`reports.read`, `users.read`, `settings.manage`, …) |
| Waiter | `/waiter/*` | `WaiterLayout` (tablet-first, bottom nav on phones) | `orders.create` |
| Kitchen (KDS) | `/kitchen/*` | `KitchenLayout` (dark, fullscreen, 20px+ type) | `kitchen.read` |
| Cashier | `/cashier/*` | `CashierLayout` | `payments.create` or `cash-shifts.open` |
| Stock | `/stock/*` | `StockLayout` | `inventory.read` |
| Platform | `/platform/*` | `PlatformLayout` (no branch) | `isPlatformAdmin` |
| Account | `/profile` | `AccountLayout` | any signed-in user |

`/` picks the default workspace by role (cook→kitchen, waiter→waiter, cashier→cashier, stockkeeper→stock,
platform admin without org→platform, others→admin) — see `src/app/navigation/workspaces.ts`.

## Commands

```bash
npm install
npm run dev        # http://localhost:5173 (backend: VITE_API_BASE_URL, default http://localhost:5080/api/v1)
npm run lint
npm run typecheck
npm run test       # Vitest + RTL + msw
npm run build
npm run preview
node ../scripts/check-file-length.mjs   # ≤ 500 lines per source file (CI)
```

Config: copy `.env.example` → `.env.local`. Only public values in `VITE_*`. Validated in `src/shared/config/env.ts`.
Deploy: `vercel.json` (SPA rewrite to `index.html`).

## Folder structure

```
src/
  app/          providers (Auth, Branch, Realtime), router (registry, guards), layouts, navigation (nav configs)
  pages/        route screens (thin: compose features/entities/ui)
  widgets/      topbar pieces (branch/org/language switchers, user menu, bell, connection status)
  features/     user-facing actions: forms, modals, row actions (e.g. features/users/ui/UserFormModal.tsx)
  entities/     API types + TanStack Query hooks per resource (e.g. entities/user/user.queries.ts)
  shared/
    api/        api-client.ts (the ONE client), api-error.ts, endpoints.ts, idempotency.ts, query-client.ts, session-store.ts
    config/     env.ts
    constants/  routes.ts, permissions.ts (ONLY permission catalog), statuses.ts (status → tone), locale.ts
    hooks/      use-auth, use-permissions (hasPermission/hasAny), use-current-branch, use-formatters, use-media-query, use-debounced-value
    lib/        format-currency.ts, format-date.ts, validation.ts (zod), api-error-message.ts, safe-storage.ts
    realtime/   hub-manager.ts (one HubConnection), use-realtime.ts (useRealtimeEvent, useRealtimeStatus), events.ts
    i18n/       index.ts + locales/{ru,uz,en}/<namespace>.json (auto-loaded)
    ui/         design system (see list below); theme/tokens.css
  test/         setup.ts, msw-server.ts, test-utils.tsx
```

Dependency direction: `app → pages → features → entities → shared`. `shared` imports nothing above it.

## How to add a page / feature

1. **Types + API hooks** — `src/entities/<resource>/<resource>.types.ts` and `<resource>.queries.ts`:
   ```ts
   export const menuItemKeys = {
     all: ['menu-items'] as const,
     list: (params: MenuItemListParams) => [...menuItemKeys.all, 'list', params] as const,
     detail: (id: string) => [...menuItemKeys.all, 'detail', id] as const,
   };
   export function useMenuItems(params: MenuItemListParams) {
     return useQuery({
       queryKey: menuItemKeys.list(params),
       queryFn: ({ signal }) => apiClient.get<PagedResult<MenuItemDto>>(ENDPOINTS.menu.items, { params: { ...params }, signal }),
       placeholderData: keepPreviousData,
     });
   }
   // mutations: onSuccess → queryClient.invalidateQueries({ queryKey: menuItemKeys.all })
   ```
   - Key convention: `[resource, scope, params]`; invalidate by `<resource>Keys.all`. Keys do **not** include the branch:
     switching branch cancels + resets all queries (`BranchProvider`).
   - Paths go to `shared/api/endpoints.ts` (most of the contract is already there).
   - `X-Branch-Id` is sent automatically; pass `{ branchId: null }` for org-level endpoints (users, roles, branches, menu…).
   - Commands that require `Idempotency-Key` (payments, refunds, send-to-kitchen, receive): use `useIdempotencyKey()`
     from `shared/api/idempotency.ts` — one key per user action, reused on retry, `renew()` after success.
   - Errors are `ApiError { status, code, fieldErrors, correlationId }`. Never call `fetch` directly.
2. **Page** — `src/pages/<workspace>/<section>/<Name>Page.tsx` (named export). Use `PageHeader`, `Toolbar`, `DataTable`, etc.
3. **Route** — add or replace a file `src/app/router/routes/<scope>/<name>.routes.tsx`; it is picked up automatically:
   ```tsx
   export const routeModule = defineRoutes('admin', [
     { path: ROUTES.admin.menu, element: lazyPage(() => import('@/pages/admin/menu/MenuPage').then((m) => ({ default: m.MenuPage })), { anyOf: [P.menu.read] }) },
   ]);
   ```
   Scopes: `admin | waiter | kitchen | cashier | stock | platform | account | public`. Paths are absolute constants from
   `shared/constants/routes.ts` (add new ones there); a workspace home uses `{ index: true, ... }`.
   **Stubs:** every unimplemented section already has a file using `stubPage(...)` — replace its content, don't add a second route for the same path.
4. **Navigation** — admin sidebar `src/app/navigation/admin.nav.ts` (all 18 sections already listed); other workspaces in
   `src/app/navigation/workspace.nav.ts`. Each item has `anyOf` permissions.
5. **Forms** — React Hook Form + `zodResolver`. Reuse schemas from `shared/lib/validation.ts`; messages are i18n keys
   (`validation:required`) translated by `<FormField error=…>`. Server field errors: `applyServerFieldErrors(error, setError, fields)`;
   general error: `getErrorMessage(error, t)` → maps `code` to `errors:<code>` (add new codes to `errors.json`), falls back to server `title`.
6. **Permissions** — `usePermissions().hasPermission(PERMISSIONS.orders.cancel)` / `hasAny([...])`; route guard via `lazyPage(..., { anyOf })`;
   in-page guard `<RequirePermission anyOf={[...]} fallback={null}>`. Never define permission strings elsewhere.
7. **i18n** — create `src/shared/i18n/locales/{ru,uz,en}/<namespace>.json` (auto-registered). `useTranslation('<namespace>')`,
   cross-namespace `t('common:actions.save')`. Status labels: `status:<domain>.<value>`; `<StatusBadge domain="order" status={s} />`.
   Money/dates: `useFormatters()` (org currency, UI locale, branch timezone) — never `toLocaleString` ad hoc.
8. **Realtime** — `useRealtimeEvent('KitchenTicketCreated', () => queryClient.invalidateQueries({ queryKey: kitchenKeys.all }))`.
   Events are only hints: always refetch. After reconnect all queries are invalidated automatically. Extra groups
   (KDS station): `hubManager.onConnected((c) => c.invoke(HUB_METHODS.joinKitchenStation, branchId, stationId))` in an effect.
   Connection badge: `<ConnectionStatus />` / `useRealtimeStatus()`.
9. **Tests** — colocate `*.test.tsx`. `renderWithProviders(ui, { auth: makeAuth(makeUser({ permissions: [...] })) })`,
   `renderRoutes(routes, { route })` for guards; mock HTTP with `server.use(http.get(api('/x'), () => HttpResponse.json(...)))`
   from `src/test/msw-server.ts` (unhandled requests fail).
10. **Demo / not connected** — label mock integrations with `<DemoBadge />` / `<DemoBadge kind="not-connected" />`.

## UI components (`@/shared/ui`)

Button, IconButton, Input, Textarea, Select, Checkbox, Switch, FormField, FormGrid/FormActions, MoneyInput, SearchInput,
Modal, Drawer, ConfirmDialog (danger + optional reason), DropdownMenu, DataTable (server sort/pagination,
loading/empty/error), Pagination, StatusBadge, Card, StatCard, PageHeader, Tabs (in-page or route tabs), Toast (`useToast()`),
Spinner/PageLoader, Skeleton, EmptyState, ErrorState, Alert, DemoBadge, Toolbar (filter bar), ComingSoon (placeholder).

Design tokens: `src/shared/ui/theme/tokens.css`. Filled buttons / small white text use `--color-primary-strong` (#C2410C, AA);
`--color-primary` (#E85D2A) is for accents, borders, icons and large headings. `[data-workspace=waiter|cashier|stock]` → 16px,
44px touch targets; `[data-theme=kds]` → dark, 20px base.

## UX platform (F8)

- **PWA** — `vite-plugin-pwa` (generateSW, `registerType: 'prompt'`). Manifest + icons in `public/` (PNG icons rendered
  from `favicon.svg`). The service worker precaches build assets only; there is **no runtime caching** — `/api`, `/hubs`
  and any cross-origin API requests always go to the network. A new build shows «Доступна новая версия — обновить»
  (`app/pwa/PwaUpdatePrompt`, production only); `app/pwa/OfflineBanner` shows while `navigator.onLine` is false.
  `vercel.json` serves `sw.js`/`manifest.webmanifest` with `no-cache`.
- **Theme** — user menu → system / light / dark, stored per device (`respos.theme`, `shared/lib/theme.ts`,
  `useTheme()`); resolved value on `<html data-theme="light|dark">` (applied before first paint in `index.html`).
  Dark tokens: `:root[data-theme='dark']` in `tokens.css` (AA contrast). Filled accents use `--color-on-primary` /
  `--color-on-danger`, never hard-coded `#fff`. KDS always uses its own dark set (`[data-theme='kds']`).
- **Fullscreen** — `widgets/topbar/FullscreenToggle` (`useFullscreen`) on KDS and waiter topbars.
- **Printing (80 mm thermal)** — `<PrintArea id>` + `printArea(id)` from `@/shared/ui`: content is rendered only during
  the print job, everything else is hidden, `@page thermal { size: 80mm auto; margin: 0 }`, black on white. Used by the
  KDS ticket (printer button on each card), the cashier pre-check («Печать (80 мм)», also on Ctrl+P while open) and the
  cash shift drawer («Печать Z-отчёта» / X-report for an open shift).
- **Keyboard shortcuts** — `useShortcuts([...])` (`shared/hooks/use-shortcuts.ts`); `?` or the keyboard button in the
  topbar lists the shortcuts of the current screen. Plain keys never fire while typing in a field, Enter never hijacks
  a focused button, nothing fires while a dialog is open. Targets are `data-shortcut="…"` attributes.

  | Screen | Key | Action |
  |---|---|---|
  | Cashier | `F2` | focus order search |
  | Cashier | `Enter` | pay (submit the payment form) |
  | Cashier | `1` / `2` / `3` | payment method cash / card / other |
  | Waiter order | `/` | focus menu search |
  | Waiter order | `Ctrl+Enter` | send to kitchen |
  | Any with shortcuts | `?` | show / hide shortcuts help |
- **Locales** — `shared/i18n/locales.parity.test.ts` fails if a namespace is missing in ru/uz/en, key sets differ
  (plural suffixes normalised) or `en` contains Cyrillic text. New namespaces must ship all three files.

## Auth

Access token in memory only (`session-store.ts`); on start `POST /auth/refresh` (httpOnly cookie) restores the session and the
token is refreshed 60 s before expiry. 401 → single-flight refresh → retry once → otherwise logout. Branch id, language and
theme are the only things kept in `localStorage`.

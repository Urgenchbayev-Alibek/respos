# Permission catalog and default roles

Backend: single catalog `Restaurant.Domain/Constants/Permissions.cs` (nested static classes, `const string`).
Frontend: single mirror `respos-admin/src/shared/constants/permissions.ts`. No other place defines these strings.

## Permissions

```
users.read  users.create  users.update  users.deactivate
roles.read  roles.manage
branches.read  branches.manage
menu.read  menu.manage
tables.read  tables.manage
reservations.read  reservations.manage
orders.read  orders.create  orders.update  orders.cancel  orders.discount.apply  orders.transfer
kitchen.read  kitchen.status.update  kitchen.stations.manage
inventory.read  inventory.manage  inventory.adjust
recipes.read  recipes.manage
suppliers.read  suppliers.manage
purchases.read  purchases.manage  purchases.receive
payments.read  payments.create  payments.refund
cash-shifts.read  cash-shifts.open  cash-shifts.close
reports.read
notifications.read
settings.manage
audit.read
```

Platform (only for `User.IsPlatformAdmin = true`, not org roles):

```
platform.organizations.read  platform.organizations.manage
platform.plans.manage  platform.feature-flags.manage
platform.system.read  platform.demo-requests.read
platform.tenant-data.access      // break-glass; every use is audited with a reason
```

## Default system roles (seeded per organization, `IsSystem = true`, editable copies allowed)

| Code | Name RU | Permissions |
|---|---|---|
| `owner` | Владелец | ALL org permissions; access to all branches |
| `admin` | Администратор | ALL org permissions except none (same as owner but cannot delete owner); all branches |
| `manager` | Менеджер | *.read for all + tables.manage, reservations.manage, menu.manage, orders.*, kitchen.*, inventory.read, purchases.read, payments.read, cash-shifts.read, reports.read, notifications.read, audit.read |
| `waiter` | Официант | tables.read, reservations.read, reservations.manage, menu.read, orders.read, orders.create, orders.update, kitchen.read, notifications.read |
| `cook` | Повар | kitchen.read, kitchen.status.update, menu.read, notifications.read |
| `cashier` | Кассир | orders.read, menu.read, tables.read, payments.read, payments.create, payments.refund, cash-shifts.read, cash-shifts.open, cash-shifts.close, notifications.read |
| `stockkeeper` | Кладовщик | inventory.*, recipes.read, suppliers.*, purchases.*, menu.read, notifications.read |
| `accountant` | Бухгалтер/Аудитор | reports.read, payments.read, cash-shifts.read, audit.read, inventory.read, purchases.read |

Owner/admin have implicit access to all branches of their org; others need `UserBranchAccess` rows.

## Enforcement

- `[HasPermission(Permissions.Orders.Create)]` attribute (policy-based) on every non-public endpoint.
- Resource checks (tenant/branch ownership) in Application handlers via EF global query filters on
  `OrganizationId` (+ explicit `BranchId == currentBranch` filters in queries).
- Frontend hides UI by permission only for UX; never as protection.

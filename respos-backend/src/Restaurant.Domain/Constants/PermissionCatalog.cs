using P = Restaurant.Domain.Constants.Permissions;

namespace Restaurant.Domain.Constants;

public sealed record PermissionDefinition(string Code, string Module, string Description);

/// <summary>Descriptions + module for every permission code. Synced into the Permission table on startup.</summary>
public static class PermissionCatalog
{
    public static IReadOnlyList<PermissionDefinition> All { get; } =
    [
        new(P.Users.Read, "users", "Просмотр сотрудников"),
        new(P.Users.Create, "users", "Создание и приглашение сотрудников"),
        new(P.Users.Update, "users", "Изменение сотрудников, ролей и филиалов"),
        new(P.Users.Deactivate, "users", "Блокировка и деактивация сотрудников"),
        new(P.Roles.Read, "roles", "Просмотр ролей и прав"),
        new(P.Roles.Manage, "roles", "Управление ролями"),
        new(P.Branches.Read, "branches", "Просмотр филиалов"),
        new(P.Branches.Manage, "branches", "Управление филиалами"),
        new(P.Menu.Read, "menu", "Просмотр меню"),
        new(P.Menu.Manage, "menu", "Управление меню"),
        new(P.Tables.Read, "tables", "Просмотр зон и столиков"),
        new(P.Tables.Manage, "tables", "Управление зонами и столиками"),
        new(P.Reservations.Read, "reservations", "Просмотр бронирований"),
        new(P.Reservations.Manage, "reservations", "Управление бронированиями"),
        new(P.Orders.Read, "orders", "Просмотр заказов"),
        new(P.Orders.Create, "orders", "Создание заказов"),
        new(P.Orders.Update, "orders", "Изменение заказов"),
        new(P.Orders.Cancel, "orders", "Отмена заказов и отправленных позиций"),
        new(P.Orders.DiscountApply, "orders", "Применение скидок"),
        new(P.Orders.Transfer, "orders", "Перенос заказа на другой стол"),
        new(P.Kitchen.Read, "kitchen", "Просмотр кухонных заданий"),
        new(P.Kitchen.StatusUpdate, "kitchen", "Изменение статусов кухонных заданий"),
        new(P.Kitchen.StationsManage, "kitchen", "Управление кухонными станциями"),
        new(P.Inventory.Read, "inventory", "Просмотр склада"),
        new(P.Inventory.Manage, "inventory", "Управление ингредиентами и единицами"),
        new(P.Inventory.Adjust, "inventory", "Списания, корректировки, инвентаризация"),
        new(P.Recipes.Read, "recipes", "Просмотр рецептур"),
        new(P.Recipes.Manage, "recipes", "Управление рецептурами"),
        new(P.Suppliers.Read, "suppliers", "Просмотр поставщиков"),
        new(P.Suppliers.Manage, "suppliers", "Управление поставщиками"),
        new(P.Purchases.Read, "purchases", "Просмотр закупок"),
        new(P.Purchases.Manage, "purchases", "Управление закупками"),
        new(P.Purchases.Receive, "purchases", "Приёмка поставок"),
        new(P.Payments.Read, "payments", "Просмотр платежей"),
        new(P.Payments.Create, "payments", "Регистрация оплаты"),
        new(P.Payments.Refund, "payments", "Возвраты"),
        new(P.CashShifts.Read, "cash-shifts", "Просмотр кассовых смен"),
        new(P.CashShifts.Open, "cash-shifts", "Открытие кассовой смены"),
        new(P.CashShifts.Close, "cash-shifts", "Закрытие кассовой смены"),
        new(P.Reports.Read, "reports", "Просмотр отчётов"),
        new(P.Notifications.Read, "notifications", "Просмотр уведомлений"),
        new(P.Settings.Manage, "settings", "Настройки организации и филиалов"),
        new(P.Audit.Read, "audit", "Просмотр журнала аудита"),
        new(P.Platform.OrganizationsRead, "platform", "Платформа: просмотр организаций"),
        new(P.Platform.OrganizationsManage, "platform", "Платформа: управление организациями"),
        new(P.Platform.PlansManage, "platform", "Платформа: управление тарифами"),
        new(P.Platform.FeatureFlagsManage, "platform", "Платформа: feature flags"),
        new(P.Platform.SystemRead, "platform", "Платформа: состояние системы"),
        new(P.Platform.DemoRequestsRead, "platform", "Платформа: заявки на демо"),
        new(P.Platform.TenantDataAccess, "platform", "Платформа: служебный доступ к данным (аудируется)"),
    ];

    private static readonly HashSet<string> Codes = All.Select(p => p.Code).ToHashSet(StringComparer.Ordinal);

    public static IReadOnlyList<string> OrganizationCodes { get; } =
        All.Where(p => !P.IsPlatform(p.Code)).Select(p => p.Code).ToArray();

    public static IReadOnlyList<string> PlatformCodes { get; } =
        All.Where(p => P.IsPlatform(p.Code)).Select(p => p.Code).ToArray();

    public static bool Exists(string code) => Codes.Contains(code);

    public static bool IsAssignableToRole(string code) => Exists(code) && !P.IsPlatform(code);
}

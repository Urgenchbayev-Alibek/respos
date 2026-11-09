namespace Restaurant.Domain.Constants;

/// <summary>
/// The single backend permission catalog (mirrors respos-contracts/PERMISSIONS.md).
/// Descriptions and module grouping live in <see cref="PermissionCatalog"/>.
/// </summary>
public static class Permissions
{
    public static class Users
    {
        public const string Read = "users.read";
        public const string Create = "users.create";
        public const string Update = "users.update";
        public const string Deactivate = "users.deactivate";
    }

    public static class Roles
    {
        public const string Read = "roles.read";
        public const string Manage = "roles.manage";
    }

    public static class Branches
    {
        public const string Read = "branches.read";
        public const string Manage = "branches.manage";
    }

    public static class Menu
    {
        public const string Read = "menu.read";
        public const string Manage = "menu.manage";
    }

    public static class Tables
    {
        public const string Read = "tables.read";
        public const string Manage = "tables.manage";
    }

    public static class Reservations
    {
        public const string Read = "reservations.read";
        public const string Manage = "reservations.manage";
    }

    public static class Orders
    {
        public const string Read = "orders.read";
        public const string Create = "orders.create";
        public const string Update = "orders.update";
        public const string Cancel = "orders.cancel";
        public const string DiscountApply = "orders.discount.apply";
        public const string Transfer = "orders.transfer";
    }

    public static class Kitchen
    {
        public const string Read = "kitchen.read";
        public const string StatusUpdate = "kitchen.status.update";
        public const string StationsManage = "kitchen.stations.manage";
    }

    public static class Inventory
    {
        public const string Read = "inventory.read";
        public const string Manage = "inventory.manage";
        public const string Adjust = "inventory.adjust";
    }

    public static class Recipes
    {
        public const string Read = "recipes.read";
        public const string Manage = "recipes.manage";
    }

    public static class Suppliers
    {
        public const string Read = "suppliers.read";
        public const string Manage = "suppliers.manage";
    }

    public static class Purchases
    {
        public const string Read = "purchases.read";
        public const string Manage = "purchases.manage";
        public const string Receive = "purchases.receive";
    }

    public static class Payments
    {
        public const string Read = "payments.read";
        public const string Create = "payments.create";
        public const string Refund = "payments.refund";
    }

    public static class CashShifts
    {
        public const string Read = "cash-shifts.read";
        public const string Open = "cash-shifts.open";
        public const string Close = "cash-shifts.close";
    }

    public static class Reports
    {
        public const string Read = "reports.read";
    }

    public static class Notifications
    {
        public const string Read = "notifications.read";
    }

    public static class Settings
    {
        public const string Manage = "settings.manage";
    }

    public static class Audit
    {
        public const string Read = "audit.read";
    }

    /// <summary>Only for users with <c>IsPlatformAdmin = true</c>; never assignable to org roles.</summary>
    public static class Platform
    {
        public const string OrganizationsRead = "platform.organizations.read";
        public const string OrganizationsManage = "platform.organizations.manage";
        public const string PlansManage = "platform.plans.manage";
        public const string FeatureFlagsManage = "platform.feature-flags.manage";
        public const string SystemRead = "platform.system.read";
        public const string DemoRequestsRead = "platform.demo-requests.read";
        public const string TenantDataAccess = "platform.tenant-data.access";
    }

    public const string PlatformPrefix = "platform.";

    public static bool IsPlatform(string code) => code.StartsWith(PlatformPrefix, StringComparison.Ordinal);
}

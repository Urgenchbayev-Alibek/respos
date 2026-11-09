using P = Restaurant.Domain.Constants.Permissions;

namespace Restaurant.Domain.Constants;

public sealed record SystemRoleDefinition(string Code, string Name, IReadOnlyList<string> Permissions);

/// <summary>Default roles seeded per organization (IsSystem = true). See PERMISSIONS.md.</summary>
public static class SystemRoles
{
    public const string Owner = "owner";
    public const string Admin = "admin";
    public const string Manager = "manager";
    public const string Waiter = "waiter";
    public const string Cook = "cook";
    public const string Cashier = "cashier";
    public const string Stockkeeper = "stockkeeper";
    public const string Accountant = "accountant";

    /// <summary>Roles that implicitly see every branch of the organization.</summary>
    public static IReadOnlyList<string> AllBranchRoles { get; } = [Owner, Admin];

    public static IReadOnlyList<SystemRoleDefinition> All { get; } =
    [
        new(Owner, "Владелец", PermissionCatalog.OrganizationCodes),
        new(Admin, "Администратор", PermissionCatalog.OrganizationCodes),
        new(Manager, "Менеджер", ManagerPermissions()),
        new(Waiter, "Официант",
        [
            P.Tables.Read, P.Reservations.Read, P.Reservations.Manage, P.Menu.Read, P.Orders.Read,
            P.Orders.Create, P.Orders.Update, P.Kitchen.Read, P.Notifications.Read,
        ]),
        new(Cook, "Повар", [P.Kitchen.Read, P.Kitchen.StatusUpdate, P.Menu.Read, P.Notifications.Read]),
        new(Cashier, "Кассир",
        [
            P.Orders.Read, P.Menu.Read, P.Tables.Read, P.Payments.Read, P.Payments.Create, P.Payments.Refund,
            P.CashShifts.Read, P.CashShifts.Open, P.CashShifts.Close, P.Notifications.Read,
        ]),
        new(Stockkeeper, "Кладовщик",
        [
            P.Inventory.Read, P.Inventory.Manage, P.Inventory.Adjust, P.Recipes.Read, P.Suppliers.Read,
            P.Suppliers.Manage, P.Purchases.Read, P.Purchases.Manage, P.Purchases.Receive, P.Menu.Read,
            P.Notifications.Read,
        ]),
        new(Accountant, "Бухгалтер/Аудитор",
        [
            P.Reports.Read, P.Payments.Read, P.CashShifts.Read, P.Audit.Read, P.Inventory.Read, P.Purchases.Read,
            P.Notifications.Read,
        ]),
    ];

    public static bool IsAllBranchRole(string code) => AllBranchRoles.Contains(code);

    public static SystemRoleDefinition Get(string code) =>
        All.FirstOrDefault(r => r.Code == code)
        ?? throw new ArgumentOutOfRangeException(nameof(code), code, "Unknown system role.");

    private static string[] ManagerPermissions()
    {
        var reads = PermissionCatalog.OrganizationCodes.Where(c => c.EndsWith(".read", StringComparison.Ordinal));
        string[] extra =
        [
            P.Tables.Manage, P.Reservations.Manage, P.Menu.Manage,
            P.Orders.Create, P.Orders.Update, P.Orders.Cancel, P.Orders.DiscountApply, P.Orders.Transfer,
            P.Kitchen.StatusUpdate, P.Kitchen.StationsManage,
        ];
        return reads.Concat(extra).Distinct(StringComparer.Ordinal).ToArray();
    }
}

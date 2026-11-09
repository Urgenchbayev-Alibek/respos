using Restaurant.Application.Features.Organizations.Common;
using Restaurant.Domain.Constants;
using Restaurant.Domain.Entities.Identity;
using Restaurant.Domain.Enums;

namespace Restaurant.Infrastructure.Persistence.Seed.Demo;

/// <summary>One demo user per system role: {login}@demo.respos.uz (Development only).</summary>
internal static class DemoUsers
{
    public const string Domain = "demo.respos.uz";

    private static readonly (string Login, string RoleCode, string FullName)[] Users =
    [
        ("owner", SystemRoles.Owner, "Алишер Каримов"),
        ("admin", SystemRoles.Admin, "Дилноза Рахимова"),
        ("manager", SystemRoles.Manager, "Тимур Юсупов"),
        ("waiter", SystemRoles.Waiter, "Азиз Хасанов"),
        ("cook", SystemRoles.Cook, "Рустам Назаров"),
        ("cashier", SystemRoles.Cashier, "Нигора Алиева"),
        ("stock", SystemRoles.Stockkeeper, "Бахтиёр Умаров"),
        ("accountant", SystemRoles.Accountant, "Гульнора Саидова"),
    ];

    public static void Add(DemoContext context, OrganizationProvisioner provisioner, ProvisionedOrganization organization, string passwordHash)
    {
        foreach (var (login, roleCode, fullName) in Users)
        {
            var user = new User
            {
                FullName = fullName,
                PasswordHash = passwordHash,
                Status = UserStatus.Active,
                PreferredLanguage = "ru",
            };
            user.SetEmail($"{login}@{Domain}");
            context.Db.Users.Add(user);
            provisioner.AddMember(context.OrganizationId, user, [organization.Roles[roleCode]], [context.BranchId]);
        }
    }
}

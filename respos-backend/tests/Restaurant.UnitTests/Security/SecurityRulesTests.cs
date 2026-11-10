using System.Reflection;
using Restaurant.Application.Common.Validation;
using Restaurant.Domain.Constants;
using Restaurant.Domain.Entities.Identity;

namespace Restaurant.UnitTests.Security;

public sealed class PasswordPolicyTests
{
    [Theory]
    [InlineData("Demo123!", true)]
    [InlineData("abcdefg1", true)]
    [InlineData("short1", false)]
    [InlineData("onlyletters", false)]
    [InlineData("12345678", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void Policy_requires_8_chars_letter_and_digit(string? password, bool valid) =>
        PasswordPolicy.IsValid(password).Should().Be(valid);
}

public sealed class LockoutTests
{
    private static readonly DateTime Now = new(2026, 11, 10, 8, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void Fifth_failure_locks_for_15_minutes_and_success_resets()
    {
        var user = new User();
        for (var i = 0; i < 4; i++)
        {
            user.RegisterFailedLogin(Now, 5, TimeSpan.FromMinutes(15)).Should().BeFalse();
        }

        user.RegisterFailedLogin(Now, 5, TimeSpan.FromMinutes(15)).Should().BeTrue();
        user.IsLockedOut(Now.AddMinutes(14)).Should().BeTrue();
        user.IsLockedOut(Now.AddMinutes(15)).Should().BeFalse();

        user.RegisterSuccessfulLogin(Now.AddMinutes(20));
        user.FailedLoginCount.Should().Be(0);
        user.LockoutUntil.Should().BeNull();
    }
}

public sealed class PermissionCatalogTests
{
    private static IEnumerable<string> ConstantCodes() =>
        typeof(Permissions).GetNestedTypes()
            .SelectMany(t => t.GetFields(BindingFlags.Public | BindingFlags.Static))
            .Where(f => f.IsLiteral && f.FieldType == typeof(string))
            .Select(f => (string)f.GetRawConstantValue()!);

    [Fact]
    public void Every_constant_is_in_the_catalog_and_vice_versa()
    {
        var constants = ConstantCodes().ToList();

        constants.Should().OnlyHaveUniqueItems();
        PermissionCatalog.All.Select(p => p.Code).Should().BeEquivalentTo(constants);
        PermissionCatalog.All.Should().OnlyContain(p => p.Code.StartsWith(p.Module + ".", StringComparison.Ordinal));
    }

    [Fact]
    public void Catalog_matches_contract_counts()
    {
        PermissionCatalog.OrganizationCodes.Should().HaveCount(54);
        PermissionCatalog.PlatformCodes.Should().HaveCount(7);
    }

    [Fact]
    public void System_roles_use_only_assignable_org_permissions()
    {
        foreach (var role in SystemRoles.All)
        {
            role.Permissions.Should().OnlyContain(code => PermissionCatalog.IsAssignableToRole(code), role.Code);
            role.Permissions.Should().OnlyHaveUniqueItems(role.Code);
        }
    }

    [Fact]
    public void Default_role_map_follows_contract()
    {
        SystemRoles.Get(SystemRoles.Owner).Permissions.Should().BeEquivalentTo(PermissionCatalog.OrganizationCodes);
        SystemRoles.Get(SystemRoles.Admin).Permissions.Should().BeEquivalentTo(PermissionCatalog.OrganizationCodes);
        SystemRoles.Get(SystemRoles.Manager).Permissions.Should()
            .Contain([Permissions.Orders.DiscountApply, Permissions.Orders.Transfer, Permissions.Audit.Read])
            .And.NotContain([Permissions.Users.Create, Permissions.Settings.Manage, Permissions.Payments.Create]);
        SystemRoles.Get(SystemRoles.Accountant).Permissions.Should().Contain(Permissions.Notifications.Read);
        SystemRoles.Get(SystemRoles.Cook).Permissions.Should()
            .BeEquivalentTo([Permissions.Kitchen.Read, Permissions.Kitchen.StatusUpdate, Permissions.Menu.Read, Permissions.Notifications.Read, Permissions.Delivery.Read, Permissions.Staff.TimeClock]);
        SystemRoles.AllBranchRoles.Should().BeEquivalentTo([SystemRoles.Owner, SystemRoles.Admin]);
    }
}

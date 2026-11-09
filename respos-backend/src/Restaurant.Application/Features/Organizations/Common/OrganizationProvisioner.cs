using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Domain.Constants;
using Restaurant.Domain.Entities.Identity;
using Restaurant.Domain.Entities.Inventory;
using Restaurant.Domain.Entities.Saas;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Organizations.Common;

public sealed record NewOrganization(
    string Name,
    string Slug,
    string BranchName,
    string PlanCode = Plan.Business,
    string Currency = Organization.DefaultCurrency,
    bool IsDemo = false,
    string Timezone = RestaurantBranch.DefaultTimezone);

public sealed record ProvisionedOrganization(
    Organization Organization, RestaurantBranch Branch, IReadOnlyDictionary<string, Role> Roles);

/// <summary>
/// Creates a ready-to-use organization: org + first branch (+ settings) + system roles + subscription + default units.
/// Adds entities to the context only — the caller saves. Used by platform org creation, seeders and tests.
/// </summary>
[ScopedService]
public sealed class OrganizationProvisioner(IApplicationDbContext db, IClock clock)
{
    private static readonly (string Code, string Name, UnitKind Kind)[] DefaultUnits =
    [
        ("kg", "Килограмм", UnitKind.Mass), ("g", "Грамм", UnitKind.Mass),
        ("l", "Литр", UnitKind.Volume), ("ml", "Миллилитр", UnitKind.Volume),
        ("pcs", "Штука", UnitKind.Count),
    ];

    private static readonly (string From, string To, decimal Factor)[] DefaultConversions =
    [
        ("kg", "g", 1000m), ("g", "kg", 0.001m), ("l", "ml", 1000m), ("ml", "l", 0.001m),
    ];

    public async Task<ProvisionedOrganization> CreateAsync(NewOrganization request, CancellationToken cancellationToken)
    {
        var now = clock.UtcNow;
        var organization = new Organization
        {
            Name = request.Name,
            Slug = request.Slug,
            Currency = request.Currency,
            IsDemo = request.IsDemo,
        };
        db.Organizations.Add(organization);

        var branch = CreateBranch(organization.Id, request.BranchName, request.Timezone);
        var roles = SystemRoles.All.ToDictionary(r => r.Code, r => Role.CreateSystem(organization.Id, r));
        db.Roles.AddRange(roles.Values);

        var plan = await db.Plans.FirstOrDefaultAsync(p => p.Code == request.PlanCode, cancellationToken)
            ?? throw new InvalidOperationException($"Plan '{request.PlanCode}' is not seeded.");
        db.Subscriptions.Add(new Subscription
        {
            OrganizationId = organization.Id,
            PlanId = plan.Id,
            Status = SubscriptionStatus.Active,
            StartsAt = now,
        });

        AddDefaultUnits(organization.Id);
        return new ProvisionedOrganization(organization, branch, roles);
    }

    /// <summary>Adds a branch with default settings to the context.</summary>
    public RestaurantBranch CreateBranch(Guid organizationId, string name, string timezone = RestaurantBranch.DefaultTimezone)
    {
        var branch = new RestaurantBranch { OrganizationId = organizationId, Name = name, Timezone = timezone };
        db.Branches.Add(branch);
        db.BranchSettings.Add(new BranchSettings { OrganizationId = organizationId, BranchId = branch.Id });
        return branch;
    }

    /// <summary>Adds the membership, the role and (for non all-branch roles) access to the given branches.</summary>
    public void AddMember(Guid organizationId, User user, IEnumerable<Role> roles, IEnumerable<Guid> branchIds, bool isActive = true)
    {
        db.UserOrganizations.Add(new UserOrganization
        {
            OrganizationId = organizationId,
            UserId = user.Id,
            IsActive = isActive,
            JoinedAt = clock.UtcNow,
        });
        foreach (var role in roles)
        {
            db.UserRoles.Add(new UserRole { OrganizationId = organizationId, UserId = user.Id, RoleId = role.Id });
        }

        foreach (var branchId in branchIds.Distinct())
        {
            db.UserBranchAccesses.Add(new UserBranchAccess { OrganizationId = organizationId, UserId = user.Id, BranchId = branchId });
        }
    }

    private void AddDefaultUnits(Guid organizationId)
    {
        var units = DefaultUnits.ToDictionary(
            u => u.Code,
            u => new UnitOfMeasure { OrganizationId = organizationId, Code = u.Code, Name = u.Name, Kind = u.Kind });
        db.Units.AddRange(units.Values);
        db.UnitConversions.AddRange(DefaultConversions.Select(c => new UnitConversion
        {
            OrganizationId = organizationId,
            FromUnitId = units[c.From].Id,
            ToUnitId = units[c.To].Id,
            Factor = c.Factor,
        }));
    }
}

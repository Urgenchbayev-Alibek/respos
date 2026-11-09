using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Entities.Audit;
using Restaurant.Domain.Entities.Identity;
using Restaurant.Domain.Entities.Saas;

namespace Restaurant.Application.Abstractions.Persistence;

/// <summary>Identity / SaaS / audit DbSets (foundation module).</summary>
public partial interface IApplicationDbContext
{
    DbSet<Organization> Organizations { get; }
    DbSet<RestaurantBranch> Branches { get; }
    DbSet<BranchSettings> BranchSettings { get; }
    DbSet<User> Users { get; }
    DbSet<UserOrganization> UserOrganizations { get; }
    DbSet<Role> Roles { get; }
    DbSet<Permission> Permissions { get; }
    DbSet<RolePermission> RolePermissions { get; }
    DbSet<UserRole> UserRoles { get; }
    DbSet<UserBranchAccess> UserBranchAccesses { get; }
    DbSet<RefreshToken> RefreshTokens { get; }
    DbSet<UserInvitation> UserInvitations { get; }
    DbSet<PasswordResetToken> PasswordResetTokens { get; }

    DbSet<Plan> Plans { get; }
    DbSet<Feature> Features { get; }
    DbSet<PlanFeature> PlanFeatures { get; }
    DbSet<Subscription> Subscriptions { get; }
    DbSet<FeatureFlag> FeatureFlags { get; }
    DbSet<BillingEvent> BillingEvents { get; }
    DbSet<DemoRequest> DemoRequests { get; }

    DbSet<AuditLog> AuditLogs { get; }
    DbSet<IdempotencyRecord> IdempotencyRecords { get; }
}

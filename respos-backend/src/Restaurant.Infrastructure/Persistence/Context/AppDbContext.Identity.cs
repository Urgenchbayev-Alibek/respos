using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Entities.Audit;
using Restaurant.Domain.Entities.Identity;
using Restaurant.Domain.Entities.Saas;

namespace Restaurant.Infrastructure.Persistence.Context;

/// <summary>Identity module DbSets (implements IApplicationDbContext.Identity.cs).</summary>
public sealed partial class AppDbContext
{
    public DbSet<Organization> Organizations => Set<Organization>();
    public DbSet<RestaurantBranch> Branches => Set<RestaurantBranch>();
    public DbSet<BranchSettings> BranchSettings => Set<BranchSettings>();
    public DbSet<User> Users => Set<User>();
    public DbSet<UserOrganization> UserOrganizations => Set<UserOrganization>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<UserBranchAccess> UserBranchAccesses => Set<UserBranchAccess>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<UserInvitation> UserInvitations => Set<UserInvitation>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    public DbSet<Plan> Plans => Set<Plan>();
    public DbSet<Feature> Features => Set<Feature>();
    public DbSet<PlanFeature> PlanFeatures => Set<PlanFeature>();
    public DbSet<Subscription> Subscriptions => Set<Subscription>();
    public DbSet<FeatureFlag> FeatureFlags => Set<FeatureFlag>();
    public DbSet<BillingEvent> BillingEvents => Set<BillingEvent>();
    public DbSet<DemoRequest> DemoRequests => Set<DemoRequest>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<IdempotencyRecord> IdempotencyRecords => Set<IdempotencyRecord>();
}

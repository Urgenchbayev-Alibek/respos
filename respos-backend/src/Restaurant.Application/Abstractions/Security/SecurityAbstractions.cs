using Restaurant.Domain.Entities.Identity;

namespace Restaurant.Application.Abstractions.Security;

public interface IPasswordHasher
{
    string Hash(string password);

    bool Verify(string passwordHash, string password);
}

public sealed record AccessToken(string Token, DateTime ExpiresAt);

/// <summary>Issues signed JWT access tokens (claims: sub, org, platform_admin, email).</summary>
public interface ITokenService
{
    AccessToken CreateAccessToken(User user, Guid? organizationId);

    /// <summary>Break-glass token: platform admin, read-only access to <paramref name="organizationId"/>, no refresh token.</summary>
    AccessToken CreateTenantAccessToken(User user, Guid organizationId, TimeSpan lifetime);
}

/// <summary>Opaque random tokens (refresh, reset, invitation). Only <see cref="Hash"/> is persisted.</summary>
public interface ISecureTokenGenerator
{
    string Generate();

    string Hash(string token);
}

/// <summary>Effective permissions of a user in an organization (loaded from DB, cached per request).</summary>
public interface IPermissionService
{
    Task<IReadOnlySet<string>> GetPermissionsAsync(Guid userId, Guid? organizationId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<string>> GetRoleCodesAsync(Guid userId, Guid organizationId, CancellationToken cancellationToken = default);

    /// <summary>True when the current user (tenant context) has <paramref name="permission"/> in the current org.</summary>
    Task<bool> CurrentUserHasAsync(string permission, CancellationToken cancellationToken = default);
}

public sealed record BranchSummary(Guid Id, string Name, string Timezone);

/// <summary>Branch access: owner/admin = all active branches of the org; others = UserBranchAccess rows.</summary>
public interface IBranchAccessService
{
    Task<bool> HasAccessAsync(Guid userId, Guid organizationId, Guid branchId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<BranchSummary>> GetAccessibleBranchesAsync(Guid userId, Guid organizationId, CancellationToken cancellationToken = default);
}

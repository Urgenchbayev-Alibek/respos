namespace Restaurant.Application.Abstractions.Context;

/// <summary>
/// Request-scoped tenant/user context. Populated from the validated JWT (user, organization) and,
/// for endpoints marked <c>[RequireBranch]</c>, from the validated <c>X-Branch-Id</c> header.
/// Never populated from request bodies.
/// </summary>
public interface ITenantContext
{
    Guid? UserId { get; }
    Guid? OrganizationId { get; }
    Guid? BranchId { get; }
    bool IsPlatformAdmin { get; }

    /// <summary>Break-glass platform session for <see cref="OrganizationId"/>: read-only (only *.read permissions, GET requests).</summary>
    bool IsReadOnlyTenantAccess { get; }

    /// <summary>Current user id or throws 401 <c>auth.unauthenticated</c>.</summary>
    Guid RequireUserId();

    /// <summary>Current organization id or throws 403 <c>tenant.required</c>.</summary>
    Guid RequireOrganizationId();

    /// <summary>Validated branch id or throws 403 <c>tenant.branch_forbidden</c>.</summary>
    Guid RequireBranchId();
}

/// <summary>HTTP request metadata for auditing / security decisions.</summary>
public interface IRequestInfo
{
    string? IpAddress { get; }
    string? CorrelationId { get; }
    string? UserAgent { get; }
}

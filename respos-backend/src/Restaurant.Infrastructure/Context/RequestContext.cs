using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Common.Errors;
using Restaurant.Domain.Exceptions;

namespace Restaurant.Infrastructure.Context;

/// <summary>
/// Mutable, request-scoped implementation of <see cref="ITenantContext"/> / <see cref="IRequestInfo"/>.
/// Populated by the API (claims middleware, branch filter, hub) or explicitly by seeders/tests.
/// </summary>
public sealed class RequestContext : ITenantContext, IRequestInfo
{
    public Guid? UserId { get; private set; }
    public Guid? OrganizationId { get; private set; }
    public Guid? BranchId { get; private set; }
    public bool IsPlatformAdmin { get; private set; }
    public bool IsReadOnlyTenantAccess { get; private set; }

    public string? IpAddress { get; private set; }
    public string? CorrelationId { get; private set; }
    public string? UserAgent { get; private set; }

    public void SetUser(Guid? userId, Guid? organizationId, bool isPlatformAdmin, bool isReadOnlyTenantAccess = false)
    {
        UserId = userId;
        OrganizationId = organizationId;
        IsPlatformAdmin = isPlatformAdmin;
        IsReadOnlyTenantAccess = isReadOnlyTenantAccess && isPlatformAdmin && organizationId is not null;
        BranchId = null;
    }

    public void SetOrganization(Guid? organizationId)
    {
        OrganizationId = organizationId;
        BranchId = null;
    }

    public void SetBranch(Guid branchId) => BranchId = branchId;

    public void SetRequest(string? ipAddress, string? correlationId, string? userAgent)
    {
        IpAddress = ipAddress;
        CorrelationId = correlationId;
        UserAgent = userAgent;
    }

    public Guid RequireUserId() => UserId ?? throw new DomainException(TenantErrors.Unauthenticated);

    public Guid RequireOrganizationId() => OrganizationId ?? throw new DomainException(TenantErrors.Required);

    public Guid RequireBranchId() => BranchId ?? throw new DomainException(TenantErrors.BranchForbidden);
}

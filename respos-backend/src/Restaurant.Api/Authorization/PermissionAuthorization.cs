using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Security;

namespace Restaurant.Api.Authorization;

public sealed record PermissionRequirement(IReadOnlyList<string> AnyOf) : IAuthorizationRequirement;

/// <summary>Creates "perm:a|b" policies on demand (no central policy list).</summary>
public sealed class PermissionPolicyProvider(IOptions<AuthorizationOptions> options) : DefaultAuthorizationPolicyProvider(options)
{
    public override async Task<AuthorizationPolicy?> GetPolicyAsync(string policyName)
    {
        if (!policyName.StartsWith(HasPermissionAttribute.PolicyPrefix, StringComparison.Ordinal))
        {
            return await base.GetPolicyAsync(policyName);
        }

        var permissions = policyName[HasPermissionAttribute.PolicyPrefix.Length..].Split('|');
        return new AuthorizationPolicyBuilder()
            .RequireAuthenticatedUser()
            .AddRequirements(new PermissionRequirement(permissions))
            .Build();
    }
}

/// <summary>Checks the requirement against permissions loaded from the DB for (user, current org).</summary>
public sealed class PermissionAuthorizationHandler(IPermissionService permissions, ITenantContext tenant)
    : AuthorizationHandler<PermissionRequirement>
{
    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context, PermissionRequirement requirement)
    {
        if (tenant.UserId is not { } userId)
        {
            return;
        }

        var granted = await permissions.GetPermissionsAsync(userId, tenant.OrganizationId);
        if (requirement.AnyOf.Any(granted.Contains))
        {
            context.Succeed(requirement);
        }
    }
}

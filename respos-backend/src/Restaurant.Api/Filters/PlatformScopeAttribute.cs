using Microsoft.AspNetCore.Mvc.Filters;
using Restaurant.Infrastructure.Context;

namespace Restaurant.Api.Filters;

/// <summary>
/// Platform super-admin endpoints run without a tenant scope even when the caller's token carries <c>org</c>
/// (a platform admin who is also a member of an organization). Otherwise the global tenant filter would narrow platform
/// aggregates to that organization and the tenant interceptor would reject provisioning another organization's rows.
/// Authorization (platform permissions) has already run against the token's context.
/// </summary>
[AttributeUsage(AttributeTargets.Class)]
public sealed class PlatformScopeAttribute : Attribute, IFilterFactory
{
    public bool IsReusable => false;

    public IFilterMetadata CreateInstance(IServiceProvider serviceProvider) =>
        ActivatorUtilities.CreateInstance<PlatformScopeFilter>(serviceProvider);
}

internal sealed class PlatformScopeFilter(RequestContext context) : IAsyncActionFilter
{
    public Task OnActionExecutionAsync(ActionExecutingContext actionContext, ActionExecutionDelegate next)
    {
        context.SetOrganization(null);
        return next();
    }
}

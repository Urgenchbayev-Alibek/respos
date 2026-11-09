using Microsoft.AspNetCore.Mvc.Filters;
using Restaurant.Api.Errors;
using Restaurant.Application.Abstractions.Security;
using Restaurant.Application.Common.Errors;
using Restaurant.Infrastructure.Context;

namespace Restaurant.Api.Filters;

/// <summary>
/// Requires a valid <c>X-Branch-Id</c> header the current user can access; then exposes it as
/// <c>ITenantContext.BranchId</c>. Missing/invalid/forbidden → 403 <c>tenant.branch_forbidden</c>.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class RequireBranchAttribute : Attribute, IFilterFactory
{
    public const string HeaderName = "X-Branch-Id";

    public bool IsReusable => false;

    public IFilterMetadata CreateInstance(IServiceProvider serviceProvider) =>
        ActivatorUtilities.CreateInstance<BranchAccessFilter>(serviceProvider);
}

internal sealed class BranchAccessFilter(RequestContext context, IBranchAccessService branchAccess) : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext actionContext, ActionExecutionDelegate next)
    {
        var header = actionContext.HttpContext.Request.Headers[RequireBranchAttribute.HeaderName].ToString();
        if (!Guid.TryParse(header, out var branchId)
            || context.UserId is not { } userId
            || context.OrganizationId is not { } organizationId
            || !await branchAccess.HasAccessAsync(userId, organizationId, branchId, actionContext.HttpContext.RequestAborted))
        {
            actionContext.Result = ApiProblems.ToResult(actionContext.HttpContext, TenantErrors.BranchForbidden);
            return;
        }

        context.SetBranch(branchId);
        await next();
    }
}

using System.Security.Claims;
using Restaurant.Infrastructure.Context;
using Restaurant.Infrastructure.Identity;

namespace Restaurant.Api.Middleware;

/// <summary>After authentication: fills the scoped RequestContext from validated JWT claims + request metadata.</summary>
public sealed class RequestContextMiddleware(RequestDelegate next)
{
    public Task InvokeAsync(HttpContext context, RequestContext requestContext)
    {
        requestContext.SetRequest(
            context.Connection.RemoteIpAddress?.ToString(),
            CorrelationIdMiddleware.Get(context),
            context.Request.Headers.UserAgent.ToString());
        Populate(requestContext, context.User);
        return next(context);
    }

    public static void Populate(RequestContext requestContext, ClaimsPrincipal? user)
    {
        if (user?.Identity?.IsAuthenticated != true)
        {
            return;
        }

        var userId = TryGuid(user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub"));
        var organizationId = TryGuid(user.FindFirstValue(JwtOptions.OrganizationClaim));
        var isPlatformAdmin = string.Equals(user.FindFirstValue(JwtOptions.PlatformAdminClaim), "true", StringComparison.OrdinalIgnoreCase);
        requestContext.SetUser(userId, organizationId, isPlatformAdmin);
    }

    private static Guid? TryGuid(string? value) => Guid.TryParse(value, out var id) ? id : null;
}

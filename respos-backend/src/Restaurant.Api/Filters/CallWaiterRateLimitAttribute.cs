using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Options;
using Restaurant.Api.Errors;
using Restaurant.Api.Extensions;
using Restaurant.Application.Features.PublicMenu.WaiterCalls;

namespace Restaurant.Api.Filters;

/// <summary>
/// Fixed-window limiters for the anonymous call-waiter button: per client IP + branch slug + table
/// (<c>PublicMenu:CallWaiterPerTablePerMinute</c>, default 3/min) and per client IP overall
/// (<c>PublicMenu:CallWaiterPerIpPerHour</c>, default 60/h) against table-number enumeration.
/// </summary>
public sealed class CallWaiterRateLimiter : IDisposable
{
    private readonly PartitionedRateLimiter<string> _perTable;
    private readonly PartitionedRateLimiter<string> _perIp;

    public CallWaiterRateLimiter(IOptions<PublicMenuOptions> options)
    {
        var settings = options.Value;
        _perTable = Create(settings.CallWaiterPerTablePerMinute, TimeSpan.FromMinutes(1));
        _perIp = Create(settings.CallWaiterPerIpPerHour, TimeSpan.FromHours(1));
    }

    public bool TryAcquire(string ip, string branchSlug, string tableNumber)
    {
        using var ipLease = _perIp.AttemptAcquire(ip);
        if (!ipLease.IsAcquired)
        {
            return false;
        }

        using var tableLease = _perTable.AttemptAcquire($"{ip}|{branchSlug.Trim().ToLowerInvariant()}|{tableNumber.Trim()}");
        return tableLease.IsAcquired;
    }

    public void Dispose()
    {
        _perTable.Dispose();
        _perIp.Dispose();
    }

    private static PartitionedRateLimiter<string> Create(int permits, TimeSpan window) =>
        PartitionedRateLimiter.Create<string, string>(key => RateLimitPartition.GetFixedWindowLimiter(
            key, _ => new FixedWindowRateLimiterOptions { PermitLimit = permits, Window = window, QueueLimit = 0 }));
}

/// <summary>Applies <see cref="CallWaiterRateLimiter"/> after model binding (needs the bound table number) → 429 <c>rate_limit.exceeded</c>.</summary>
[AttributeUsage(AttributeTargets.Method)]
public sealed class CallWaiterRateLimitAttribute : Attribute, IAsyncActionFilter, IOrderedFilter
{
    public int Order => -100;

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var limiter = context.HttpContext.RequestServices.GetRequiredService<CallWaiterRateLimiter>();
        var table = context.ActionArguments.Values.OfType<CallWaiterCommand>().FirstOrDefault()?.TableNumber ?? string.Empty;
        var slug = context.RouteData.Values.TryGetValue("branchSlug", out var value) ? value?.ToString() ?? string.Empty : string.Empty;
        if (!limiter.TryAcquire(RateLimitingExtensions.ClientIp(context.HttpContext), slug, table))
        {
            context.Result = new ObjectResult(ApiProblems.Create(context.HttpContext,
                StatusCodes.Status429TooManyRequests, "rate_limit.exceeded", "Too many calls. Please wait a minute."))
            {
                StatusCode = StatusCodes.Status429TooManyRequests,
            };
            return;
        }

        await next();
    }
}

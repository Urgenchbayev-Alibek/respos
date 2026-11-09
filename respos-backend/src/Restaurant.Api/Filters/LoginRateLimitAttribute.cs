using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Options;
using Restaurant.Api.Errors;
using Restaurant.Api.Extensions;
using Restaurant.Application.Features.Auth.Login;

namespace Restaurant.Api.Filters;

/// <summary>Fixed-window limiter keyed by client IP + normalized e-mail (default 5/min).</summary>
public sealed class LoginRateLimiter : IDisposable
{
    private readonly PartitionedRateLimiter<string> _limiter;

    public LoginRateLimiter(IOptions<RateLimitingOptions> options)
    {
        var permits = options.Value.LoginPerMinute;
        _limiter = PartitionedRateLimiter.Create<string, string>(key => RateLimitPartition.GetFixedWindowLimiter(
            key, _ => new FixedWindowRateLimiterOptions { PermitLimit = permits, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    }

    public bool TryAcquire(string ip, string email)
    {
        using var lease = _limiter.AttemptAcquire($"{ip}|{email.Trim().ToLowerInvariant()}");
        return lease.IsAcquired;
    }

    public void Dispose() => _limiter.Dispose();
}

/// <summary>Applies <see cref="LoginRateLimiter"/> to the login action (keyed by the bound LoginCommand e-mail).</summary>
[AttributeUsage(AttributeTargets.Method)]
public sealed class LoginRateLimitAttribute : Attribute, IAsyncActionFilter, IOrderedFilter
{
    public int Order => -100;

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var limiter = context.HttpContext.RequestServices.GetRequiredService<LoginRateLimiter>();
        var email = context.ActionArguments.Values.OfType<LoginCommand>().FirstOrDefault()?.Email ?? string.Empty;
        if (!limiter.TryAcquire(RateLimitingExtensions.ClientIp(context.HttpContext), email))
        {
            context.Result = new Microsoft.AspNetCore.Mvc.ObjectResult(ApiProblems.Create(context.HttpContext,
                StatusCodes.Status429TooManyRequests, "rate_limit.exceeded", "Too many login attempts. Try again later."))
            {
                StatusCode = StatusCodes.Status429TooManyRequests,
            };
            return;
        }

        await next();
    }
}

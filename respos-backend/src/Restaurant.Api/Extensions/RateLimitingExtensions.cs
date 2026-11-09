using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using Restaurant.Api.Errors;

namespace Restaurant.Api.Extensions;

public sealed class RateLimitingOptions
{
    public const string SectionName = "RateLimiting";

    public int GlobalPermitPerMinute { get; set; } = 300;
    public int LoginPerMinute { get; set; } = 5;
    public int AuthPerMinute { get; set; } = 20;
    public int DemoRequestsPerHour { get; set; } = 5;
}

/// <summary>Built-in ASP.NET Core rate limiter: global per user/IP, "auth" per IP, "public-demo" per IP. Login: see LoginRateLimitAttribute.</summary>
public static class RateLimitingExtensions
{
    public const string AuthPolicy = "auth";
    public const string RefreshPolicy = "auth-refresh";
    public const string PublicDemoPolicy = "public-demo";

    public static IServiceCollection AddApiRateLimiting(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<RateLimitingOptions>(configuration.GetSection(RateLimitingOptions.SectionName));
        services.AddSingleton<Filters.LoginRateLimiter>();
        services.AddRateLimiter(options =>
        {
            var settings = configuration.GetSection(RateLimitingOptions.SectionName).Get<RateLimitingOptions>() ?? new RateLimitingOptions();
            options.OnRejected = async (context, token) =>
                await ApiProblems.WriteAsync(context.HttpContext, StatusCodes.Status429TooManyRequests, "rate_limit.exceeded", "Too many requests. Try again later.");

            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(http =>
                RateLimitPartition.GetFixedWindowLimiter(
                    http.User.FindFirst("sub")?.Value ?? ClientIp(http),
                    _ => Window(settings.GlobalPermitPerMinute, TimeSpan.FromMinutes(1))));

            options.AddPolicy(AuthPolicy, http => RateLimitPartition.GetFixedWindowLimiter(
                ClientIp(http), _ => Window(settings.AuthPerMinute, TimeSpan.FromMinutes(1))));

            // Refresh is limited per session, not per IP: all devices of a restaurant usually share one NAT address,
            // and a power cut / Wi-Fi blip makes every tablet reload at once. Requests without a cookie fall back to IP.
            options.AddPolicy(RefreshPolicy, http => RateLimitPartition.GetFixedWindowLimiter(
                RefreshPartitionKey(http), _ => Window(settings.AuthPerMinute, TimeSpan.FromMinutes(1))));

            options.AddPolicy(PublicDemoPolicy, http => RateLimitPartition.GetFixedWindowLimiter(
                ClientIp(http), _ => Window(settings.DemoRequestsPerHour, TimeSpan.FromHours(1))));
        });
        return services;
    }

    /// <summary>Hash of the refresh cookie (the raw token never becomes a dictionary key), or the client IP.</summary>
    public static string RefreshPartitionKey(HttpContext http)
    {
        if (http.Request.Cookies.TryGetValue(Controllers.AuthController.RefreshCookieName, out var token) && !string.IsNullOrEmpty(token))
        {
            var hash = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token));
            return "rt:" + Convert.ToHexString(hash, 0, 16);
        }

        return "ip:" + ClientIp(http);
    }

    public static string ClientIp(HttpContext http) => http.Connection.RemoteIpAddress?.ToString() ?? "unknown";

    private static FixedWindowRateLimiterOptions Window(int permits, TimeSpan window) => new()
    {
        PermitLimit = permits,
        Window = window,
        QueueLimit = 0,
        AutoReplenishment = true,
    };
}

using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace Restaurant.Api.Extensions;

/// <summary>
/// F7 rate limits for anonymous reservation endpoints, partitioned per client IP AND branch slug:
/// <c>RateLimiting:PublicReservationsPerHour</c> (default 10) for POST, <c>RateLimiting:PublicAvailabilityPerMinute</c> (60) for GET.
/// </summary>
public static class PublicReservationRateLimits
{
    public const string CreatePolicy = "public-reservations";
    public const string AvailabilityPolicy = "public-availability";

    public static IServiceCollection AddPublicReservationRateLimits(this IServiceCollection services, IConfiguration configuration)
    {
        var perHour = configuration.GetValue("RateLimiting:PublicReservationsPerHour", 10);
        var perMinute = configuration.GetValue("RateLimiting:PublicAvailabilityPerMinute", 60);
        services.Configure<RateLimiterOptions>(options =>
        {
            options.AddPolicy(CreatePolicy, http => RateLimitPartition.GetFixedWindowLimiter(
                Key(http), _ => Window(perHour, TimeSpan.FromHours(1))));
            options.AddPolicy(AvailabilityPolicy, http => RateLimitPartition.GetFixedWindowLimiter(
                Key(http), _ => Window(perMinute, TimeSpan.FromMinutes(1))));
        });
        return services;
    }

    private static string Key(HttpContext http) =>
        RateLimitingExtensions.ClientIp(http) + "|" + ((http.Request.RouteValues["branchSlug"]?.ToString() ?? string.Empty).ToLowerInvariant());

    private static FixedWindowRateLimiterOptions Window(int permits, TimeSpan window) => new()
    {
        PermitLimit = Math.Max(1, permits),
        Window = window,
        QueueLimit = 0,
        AutoReplenishment = true,
    };
}

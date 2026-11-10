using Restaurant.Api.Filters;

namespace Restaurant.Api.Extensions;

/// <summary>Section <c>PublicMenu</c>: anonymous QR-menu limits.</summary>
public sealed class PublicMenuOptions
{
    public const string SectionName = "PublicMenu";

    public int CallWaiterPerTablePerMinute { get; set; } = 3;
    public int CallWaiterPerIpPerHour { get; set; } = 60;
}

public static class PublicMenuExtensions
{
    /// <summary>QR menu (F3): in-memory menu cache + call-waiter rate limiter.</summary>
    public static IServiceCollection AddPublicMenu(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<PublicMenuOptions>(configuration.GetSection(PublicMenuOptions.SectionName));
        services.AddMemoryCache();
        services.AddSingleton<CallWaiterRateLimiter>();
        return services;
    }
}

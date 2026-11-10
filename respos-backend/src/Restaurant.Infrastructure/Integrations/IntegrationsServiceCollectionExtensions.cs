using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.DataProtection.KeyManagement;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Restaurant.Application.Abstractions.Email;
using Restaurant.Application.Abstractions.Integrations;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Features.Reservations.Availability;
using Restaurant.Infrastructure.Integrations.Background;
using Restaurant.Infrastructure.Integrations.DataProtection;
using Restaurant.Infrastructure.Integrations.Email;
using Restaurant.Infrastructure.Integrations.Sms;
using Restaurant.Infrastructure.Integrations.Telegram;
using Restaurant.Infrastructure.Services;

namespace Restaurant.Infrastructure.Integrations;

public static class IntegrationsServiceCollectionExtensions
{
    public const string ApplicationName = "RestaurantOS";

    /// <summary>
    /// F7: Data Protection key ring (DB by default, or <c>DataProtection:KeysPath</c> directory), provider clients
    /// (Telegram, Eskiz, MailKit SMTP), the routing <see cref="IEmailSender"/>, outbound dispatcher and daily summary jobs.
    /// </summary>
    public static IServiceCollection AddIntegrations(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<IntegrationsOptions>(configuration.GetSection(IntegrationsOptions.SectionName));
        services.Configure<PlatformSmtpOptions>(configuration.GetSection(PlatformSmtpOptions.SectionName));
        services.Configure<ReservationAvailabilityOptions>(configuration.GetSection(ReservationAvailabilityOptions.SectionName));

        AddKeyRing(services, configuration);
        services.AddSingleton<ISecretProtector, DataProtectionSecretProtector>();
        services.AddScoped<IAdvisoryLock, PostgresAdvisoryLock>();

        services.AddMemoryCache();
        services.AddSingleton<IntegrationRetry>();
        services.AddHttpClient<ITelegramSender, TelegramBotClient>((sp, http) => Configure(http, sp, o => o.TelegramBaseUrl))
            .RemoveAllLoggers();
        services.AddHttpClient<ISmsSender, EskizSmsClient>((sp, http) => Configure(http, sp, o => o.EskizBaseUrl))
            .RemoveAllLoggers();
        services.AddSingleton<ISmtpSender, MailKitSmtpSender>();
        services.AddSingleton<IPlatformSmtpSettings, PlatformSmtpSettings>();

        services.AddSingleton<LogEmailSender>();
        services.AddScoped<IEmailSender, IntegrationEmailSender>();

        services.AddHostedService<OutboundDispatcherService>();
        services.AddHostedService<DailySummaryService>();
        return services;
    }

    private static void Configure(HttpClient http, IServiceProvider sp, Func<IntegrationsOptions, string> baseUrl)
    {
        var options = sp.GetRequiredService<IOptions<IntegrationsOptions>>().Value;
        var url = baseUrl(options);
        http.BaseAddress = new Uri(url.EndsWith('/') ? url : url + "/");
        http.Timeout = TimeSpan.FromSeconds(Math.Clamp(options.HttpTimeoutSeconds, 1, 120));
    }

    /// <summary>
    /// Keys in PostgreSQL (<c>data_protection_keys</c>) unless <c>DataProtection:KeysPath</c> is set (mounted volume).
    /// Without persisted keys, encrypted integration secrets become unreadable after a restart.
    /// </summary>
    private static void AddKeyRing(IServiceCollection services, IConfiguration configuration)
    {
        var builder = services.AddDataProtection().SetApplicationName(ApplicationName);
        var keysPath = configuration["DataProtection:KeysPath"];
        if (!string.IsNullOrWhiteSpace(keysPath))
        {
            builder.PersistKeysToFileSystem(new DirectoryInfo(keysPath));
            return;
        }

        services.AddOptions<KeyManagementOptions>()
            .Configure<IConfiguration>((options, config) =>
                options.XmlRepository = new PostgresXmlRepository(
                    config.GetConnectionString(DependencyInjection.ConnectionStringName)
                    ?? throw new InvalidOperationException("Connection string is required for the Data Protection key ring.")));
    }
}

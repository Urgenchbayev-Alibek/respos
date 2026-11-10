using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Email;
using Restaurant.Application.Abstractions.Files;
using Restaurant.Application.Abstractions.Idempotency;
using Restaurant.Application.Abstractions.Payments;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Abstractions.Security;
using Restaurant.Application.Common.Options;
using Restaurant.Application.Features.Auth.Common;
using Restaurant.Infrastructure.Audit;
using Restaurant.Infrastructure.Context;
using Restaurant.Infrastructure.Files;
using Restaurant.Infrastructure.Housekeeping;
using Restaurant.Infrastructure.Identity;
using Restaurant.Infrastructure.Idempotency;
using Restaurant.Infrastructure.Payments;
using Restaurant.Infrastructure.Persistence.Context;
using Restaurant.Infrastructure.Persistence.DomainEvents;
using Restaurant.Infrastructure.Persistence.Interceptors;
using Restaurant.Infrastructure.Persistence.Seed;
using Restaurant.Infrastructure.Services;
using IAppPasswordHasher = Restaurant.Application.Abstractions.Security.IPasswordHasher;

namespace Restaurant.Infrastructure;

public static class DependencyInjection
{
    public const string ConnectionStringName = "DefaultConnection";

    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName));
        services.Configure<AuthOptions>(configuration.GetSection(AuthOptions.SectionName));
        services.Configure<FrontendOptions>(configuration.GetSection(FrontendOptions.SectionName));
        services.Configure<FileStorageOptions>(configuration.GetSection(FileStorageOptions.SectionName));
        services.Configure<SeedOptions>(configuration.GetSection(SeedOptions.SectionName));
        services.Configure<HousekeepingOptions>(configuration.GetSection(HousekeepingOptions.SectionName));

        services.AddScoped<RequestContext>();
        services.AddScoped<ITenantContext>(sp => sp.GetRequiredService<RequestContext>());
        services.AddScoped<IRequestInfo>(sp => sp.GetRequiredService<RequestContext>());

        services.AddScoped<AuditableEntityInterceptor>();
        services.AddScoped<IDomainEventDispatcher, DomainEventDispatcher>();
        services.AddDbContext<AppDbContext>((sp, options) =>
        {
            var connectionString = sp.GetRequiredService<IConfiguration>().GetConnectionString(ConnectionStringName)
                ?? throw new InvalidOperationException($"Connection string '{ConnectionStringName}' is not configured.");
            options.UseNpgsql(connectionString, npgsql => npgsql.MigrationsHistoryTable("__ef_migrations_history"))
                .UseSnakeCaseNamingConvention()
                .ConfigureWarnings(w => w.Ignore(CoreEventId.PossibleIncorrectRequiredNavigationWithQueryFilterInteractionWarning))
                .AddInterceptors(sp.GetRequiredService<AuditableEntityInterceptor>());
        });
        services.AddScoped<IApplicationDbContext>(sp => sp.GetRequiredService<AppDbContext>());

        services.AddSingleton<IClock, SystemClock>();
        services.AddSingleton<IAppPasswordHasher, IdentityPasswordHasher>();
        services.AddSingleton<ISecureTokenGenerator, SecureTokenGenerator>();
        services.AddSingleton<ITokenService, JwtTokenService>();
        services.AddSingleton<IPaymentProvider, ManualPaymentProvider>();
        services.AddPaymentProviders(configuration);
        services.AddSingleton<IFileStorage, LocalFileStorage>();
        services.AddSingleton<IEmailSender, LogEmailSender>();
        services.AddScoped<IAuditLogger, AuditLogger>();
        services.AddScoped<IIdempotencyService, IdempotencyService>();

        services.AddScoped<HousekeepingCleaner>();
        services.AddHostedService<HousekeepingService>();

        services.AddDatabaseSeeding();
        return services;
    }
}

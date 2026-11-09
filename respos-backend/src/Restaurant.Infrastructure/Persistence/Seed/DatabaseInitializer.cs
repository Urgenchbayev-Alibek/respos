using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Restaurant.Infrastructure.Persistence.Context;

namespace Restaurant.Infrastructure.Persistence.Seed;

public sealed class SeedOptions
{
    public const string SectionName = "Seed";

    /// <summary>Seed the demo organization (honoured only in Development).</summary>
    public bool DemoData { get; set; }

    /// <summary>Password for demo users (Development only). Default "Demo123!".</summary>
    public string DemoPassword { get; set; } = "Demo123!";

    /// <summary>Password for superadmin@respos.uz. Outside Development the admin is created only when set.</summary>
    public string? PlatformAdminPassword { get; set; }
}

/// <summary>A seeding step. Steps run in ascending <see cref="Order"/>; each must be idempotent.</summary>
public interface IDataSeeder
{
    int Order { get; }

    Task SeedAsync(AppDbContext db, CancellationToken cancellationToken);
}

/// <summary>Applies migrations and runs all registered <see cref="IDataSeeder"/>s.</summary>
public sealed class DatabaseInitializer(
    AppDbContext db,
    IEnumerable<IDataSeeder> seeders,
    ILogger<DatabaseInitializer> logger)
{
    public async Task InitializeAsync(bool migrate, CancellationToken cancellationToken = default)
    {
        if (migrate)
        {
            logger.LogInformation("Applying database migrations");
            await db.Database.MigrateAsync(cancellationToken);
        }

        foreach (var seeder in seeders.OrderBy(s => s.Order))
        {
            await seeder.SeedAsync(db, cancellationToken);
            db.ChangeTracker.Clear();
        }
    }
}

public static class SeedingRegistration
{
    public static IServiceCollection AddDatabaseSeeding(this IServiceCollection services)
    {
        services.AddScoped<DatabaseInitializer>();
        foreach (var type in typeof(SeedingRegistration).Assembly.GetTypes()
                     .Where(t => t is { IsClass: true, IsAbstract: false } && typeof(IDataSeeder).IsAssignableFrom(t)))
        {
            services.AddScoped(typeof(IDataSeeder), type);
        }

        return services;
    }

    /// <summary>True when demo data may be seeded: Development environment AND Seed:DemoData=true.</summary>
    public static bool DemoSeedingAllowed(IHostEnvironment environment, IOptions<SeedOptions> options) =>
        environment.IsDevelopment() && options.Value.DemoData;
}

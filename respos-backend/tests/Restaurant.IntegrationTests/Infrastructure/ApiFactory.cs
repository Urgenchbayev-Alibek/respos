using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Restaurant.Application;
using Restaurant.Application.Abstractions.Clock;
using Testcontainers.PostgreSql;

namespace Restaurant.IntegrationTests.Infrastructure;

/// <summary>
/// One PostgreSQL container (Testcontainers) + one API host for the whole test collection.
/// Migrations and base seeders (permissions, plans) run at host startup; demo data is NOT seeded (env "Testing").
/// Tests isolate themselves by creating their own organizations (see <see cref="ApiTestBase"/>).
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    public const string TestPassword = "Test1234!";
    public const string PlatformAdminEmail = "superadmin@respos.uz";

    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .WithDatabase("respos_tests")
        .WithUsername("respos")
        .WithPassword("respos_test")
        .Build();

    /// <summary>The host's <see cref="IClock"/> (system time + adjustable offset).</summary>
    public TestClock Clock { get; } = new();

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();
        _ = Server; // builds the host → migrations + seeders run once
    }

    public new async Task DisposeAsync()
    {
        await base.DisposeAsync();
        await _postgres.DisposeAsync();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:DefaultConnection", _postgres.GetConnectionString());
        builder.UseSetting("Jwt:Issuer", "respos-test");
        builder.UseSetting("Jwt:Audience", "respos-test");
        builder.UseSetting("Jwt:SigningKey", "test-only-signing-key-with-at-least-32-bytes!!");
        builder.UseSetting("Auth:RefreshCookieSecure", "false");
        builder.UseSetting("Database:MigrateOnStartup", "true");
        builder.UseSetting("Housekeeping:Enabled", "false"); // tests call HousekeepingCleaner directly
        builder.UseSetting("Seed:PlatformAdminPassword", TestPassword);
        builder.UseSetting("RateLimiting:GlobalPermitPerMinute", "100000");
        builder.UseSetting("RateLimiting:AuthPerMinute", "100000");
        builder.UseSetting("RateLimiting:DemoRequestsPerHour", "5");
        builder.UseSetting("FileStorage:LocalRoot", Path.Combine(Path.GetTempPath(), "respos-tests-storage"));
        // F2: fake provider credentials (tests only) so Payme/Click callbacks can be exercised end to end.
        builder.UseSetting("PaymentProviders:Payme:MerchantId", "test-merchant");
        builder.UseSetting("PaymentProviders:Payme:Key", "test-payme-key");
        builder.UseSetting("PaymentProviders:Click:ServiceId", "1001");
        builder.UseSetting("PaymentProviders:Click:MerchantId", "2002");
        builder.UseSetting("PaymentProviders:Click:SecretKey", "test-click-secret");
        builder.ConfigureServices(services =>
        {
            services.AddControllers().AddApplicationPart(typeof(ApiFactory).Assembly);
            services.AddDomainEventHandlersFromAssembly(typeof(ApiFactory).Assembly);
            services.RemoveAll<IClock>();
            services.AddSingleton<IClock>(Clock);
        });
    }
}

[CollectionDefinition(Name)]
public sealed class ApiCollection : ICollectionFixture<ApiFactory>
{
    public const string Name = "api";
}

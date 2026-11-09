using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Restaurant.Infrastructure.Context;

namespace Restaurant.Infrastructure.Persistence.Context;

/// <summary>Design-time factory for `dotnet ef` (uses RESPOS_DESIGN_CONNECTION or the dev database).</summary>
internal sealed class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    private const string DevConnection = "Host=localhost;Port=5433;Database=respos;Username=respos;Password=respos_dev";

    public AppDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("RESPOS_DESIGN_CONNECTION") ?? DevConnection;
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(connectionString, npgsql => npgsql.MigrationsHistoryTable("__ef_migrations_history"))
            .UseSnakeCaseNamingConvention()
            .ConfigureWarnings(w => w.Ignore(CoreEventId.PossibleIncorrectRequiredNavigationWithQueryFilterInteractionWarning))
            .Options;
        return new AppDbContext(options, new RequestContext());
    }
}

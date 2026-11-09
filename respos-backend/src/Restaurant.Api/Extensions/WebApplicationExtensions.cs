using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Options;
using Restaurant.Api.Hubs;
using Restaurant.Api.Middleware;
using Restaurant.Infrastructure.Files;
using Restaurant.Infrastructure.Persistence.Seed;
using Serilog;

namespace Restaurant.Api.Extensions;

public static class WebApplicationExtensions
{
    public static WebApplication UseApiPipeline(this WebApplication app)
    {
        app.UseMiddleware<CorrelationIdMiddleware>();
        app.UseSerilogRequestLogging();
        app.UseMiddleware<ExceptionHandlingMiddleware>();

        if (app.Environment.IsDevelopment() || app.Configuration.GetValue<bool>("Swagger:Enabled"))
        {
            app.UseSwagger();
            app.UseSwaggerUI();
        }

        app.UseLocalFiles();
        app.UseCors(ServiceCollectionExtensions.CorsPolicy);
        app.UseAuthentication();
        app.UseMiddleware<RequestContextMiddleware>();
        app.UseRateLimiter();
        app.UseAuthorization();

        app.MapControllers();
        app.MapHub<RestaurantHub>(AuthExtensions.HubPath + "/restaurant");
        app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false }).AllowAnonymous();
        app.MapHealthChecks("/health/ready", new HealthCheckOptions { Predicate = c => c.Tags.Contains("ready") }).AllowAnonymous();
        return app;
    }

    /// <summary>Migrates (Database:MigrateOnStartup) and runs seeders (Database:SeedOnStartup, default true).</summary>
    public static async Task InitializeDatabaseAsync(this WebApplication app)
    {
        var migrate = app.Configuration.GetValue<bool>("Database:MigrateOnStartup");
        var seed = app.Configuration.GetValue("Database:SeedOnStartup", true);
        if (!migrate && !seed)
        {
            return;
        }

        await using var scope = app.Services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<DatabaseInitializer>().InitializeAsync(migrate);
    }

    private static void UseLocalFiles(this WebApplication app)
    {
        var options = app.Services.GetRequiredService<IOptions<FileStorageOptions>>().Value;
        var root = Path.GetFullPath(options.LocalRoot);
        Directory.CreateDirectory(root);
        app.UseStaticFiles(new StaticFileOptions
        {
            FileProvider = new PhysicalFileProvider(root),
            RequestPath = options.PublicBasePath,
        });
    }
}

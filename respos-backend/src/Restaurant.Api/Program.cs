using Restaurant.Api.Extensions;
using Restaurant.Api.Hubs;
using Restaurant.Application;
using Restaurant.Infrastructure;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, services, logger) => logger
    .ReadFrom.Configuration(context.Configuration)
    .ReadFrom.Services(services)
    .Enrich.FromLogContext()
    .Filter.ByExcluding(HubErrorLoggingFilter.IsExpectedHubError));

builder.Services
    .AddApplication()
    .AddInfrastructure(builder.Configuration)
    .AddApi(builder.Configuration);

var app = builder.Build();
app.Configuration.ValidateRequiredConfiguration();

app.UseApiPipeline();
await app.InitializeDatabaseAsync();
await app.RunAsync();

/// <summary>Entry point marker for WebApplicationFactory in integration tests.</summary>
public partial class Program;

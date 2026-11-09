using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Errors;
using Restaurant.Api.Filters;
using Restaurant.Api.Hubs;
using Restaurant.Application.Abstractions.Realtime;
using Restaurant.Infrastructure.Persistence.Context;
using Restaurant.Infrastructure.Realtime;

namespace Restaurant.Api.Extensions;

public static class ServiceCollectionExtensions
{
    public const string CorsPolicy = "frontend";

    public static IServiceCollection AddApi(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddControllers(options => options.Filters.Add<ValidationFilter>())
            .AddJsonOptions(options => ConfigureJson(options.JsonSerializerOptions))
            .ConfigureApiBehaviorOptions(options =>
                options.InvalidModelStateResponseFactory = context =>
                {
                    var errors = context.ModelState
                        .Where(e => e.Value?.Errors.Count > 0)
                        .ToDictionary(e => JsonNamingPolicy.CamelCase.ConvertName(e.Key.TrimStart('$', '.')), e => e.Value!.Errors.Select(x => x.ErrorMessage).ToArray());
                    var problem = ApiProblems.Create(context.HttpContext, 400, "validation.failed", "One or more fields are invalid.", errors);
                    return new BadRequestObjectResult(problem);
                });
        services.ConfigureHttpJsonOptions(options => ConfigureJson(options.SerializerOptions));

        services.AddSignalR().AddJsonProtocol(options => ConfigureJson(options.PayloadSerializerOptions));
        services.AddScoped<SignalRRealtimeNotifier<RestaurantHub>>();
        services.AddScoped<IRealtimeNotifier>(sp => sp.GetRequiredService<SignalRRealtimeNotifier<RestaurantHub>>());
        services.AddScoped<IRealtimeFlusher>(sp => sp.GetRequiredService<SignalRRealtimeNotifier<RestaurantHub>>());

        services.AddApiAuthentication();
        services.AddApiRateLimiting(configuration);
        services.AddApiSwagger();
        services.AddHealthChecks().AddDbContextCheck<AppDbContext>("database", tags: ["ready"]);
        services.AddCors(options => options.AddPolicy(CorsPolicy, policy => policy
            .WithOrigins(AllowedOrigins(configuration))
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials()
            .WithExposedHeaders("X-Correlation-Id", "Idempotent-Replayed")));
        return services;
    }

    public static void ConfigureJson(JsonSerializerOptions options)
    {
        options.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.DefaultIgnoreCondition = JsonIgnoreCondition.Never;
        options.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseLower, allowIntegerValues: false));
    }

    private static string[] AllowedOrigins(IConfiguration configuration)
    {
        var section = configuration.GetSection("Frontend:AllowedOrigins");
        var list = section.Get<string[]>() ?? (section.Value ?? string.Empty).Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return list;
    }
}

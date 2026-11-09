using Microsoft.OpenApi.Models;
using Restaurant.Api.Filters;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace Restaurant.Api.Extensions;

public static class SwaggerExtensions
{
    public static IServiceCollection AddApiSwagger(this IServiceCollection services)
    {
        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen(options =>
        {
            options.SwaggerDoc("v1", new OpenApiInfo { Title = "RestaurantOS API", Version = "v1" });
            options.CustomSchemaIds(type => type.FullName?.Replace('+', '.'));
            options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
            {
                Type = SecuritySchemeType.Http,
                Scheme = "bearer",
                BearerFormat = "JWT",
                Description = "Access token from POST /api/v1/auth/login",
            });
            options.AddSecurityRequirement(new OpenApiSecurityRequirement
            {
                [new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } }] = [],
            });
            options.OperationFilter<ContextHeadersOperationFilter>();
        });
        return services;
    }
}

/// <summary>Documents X-Branch-Id / Idempotency-Key headers for actions marked with the corresponding attributes.</summary>
internal sealed class ContextHeadersOperationFilter : IOperationFilter
{
    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        var attributes = context.MethodInfo.GetCustomAttributes(true)
            .Concat(context.MethodInfo.DeclaringType?.GetCustomAttributes(true) ?? [])
            .ToList();
        operation.Parameters ??= [];
        if (attributes.OfType<RequireBranchAttribute>().Any())
        {
            operation.Parameters.Add(Header(RequireBranchAttribute.HeaderName, "Current branch id (validated)."));
        }

        if (attributes.OfType<RequireIdempotencyKeyAttribute>().Any())
        {
            operation.Parameters.Add(Header(RequireIdempotencyKeyAttribute.HeaderName, "UUID; same key replays the stored response (24h)."));
        }
    }

    private static OpenApiParameter Header(string name, string description) => new()
    {
        Name = name,
        In = ParameterLocation.Header,
        Required = true,
        Description = description,
        Schema = new OpenApiSchema { Type = "string", Format = "uuid" },
    };
}

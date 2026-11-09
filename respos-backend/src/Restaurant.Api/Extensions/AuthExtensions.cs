using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authorization.Policy;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Restaurant.Api.Authorization;
using Restaurant.Api.Errors;
using Restaurant.Infrastructure.Identity;

namespace Restaurant.Api.Extensions;

public static class AuthExtensions
{
    public const string HubPath = "/hubs";

    public static IServiceCollection AddApiAuthentication(this IServiceCollection services)
    {
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
        services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
            .Configure<IOptions<JwtOptions>>((options, jwt) => ConfigureJwt(options, jwt.Value));

        services.AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>();
        services.AddScoped<IAuthorizationHandler, PermissionAuthorizationHandler>();
        services.AddSingleton<IAuthorizationMiddlewareResultHandler, ProblemAuthorizationResultHandler>();
        services.AddAuthorization();
        return services;
    }

    private static void ConfigureJwt(JwtBearerOptions options, JwtOptions jwt)
    {
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwt.Issuer,
            ValidateAudience = true,
            ValidAudience = jwt.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = JwtTokenService.CreateKey(jwt.SigningKey),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30),
            NameClaimType = "sub",
        };
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var token = context.Request.Query["access_token"].ToString();
                if (!string.IsNullOrEmpty(token) && context.HttpContext.Request.Path.StartsWithSegments(HubPath))
                {
                    context.Token = token;
                }

                return Task.CompletedTask;
            },
        };
    }
}

/// <summary>Writes contract ProblemDetails for 401/403 produced by the authorization middleware.</summary>
internal sealed class ProblemAuthorizationResultHandler : IAuthorizationMiddlewareResultHandler
{
    private readonly AuthorizationMiddlewareResultHandler _default = new();

    public async Task HandleAsync(RequestDelegate next, HttpContext context, AuthorizationPolicy policy, PolicyAuthorizationResult authorizeResult)
    {
        if (authorizeResult.Challenged)
        {
            await ApiProblems.WriteAsync(context, StatusCodes.Status401Unauthorized, "auth.unauthenticated", "Authentication is required.");
            return;
        }

        if (authorizeResult.Forbidden)
        {
            await ApiProblems.WriteAsync(context, StatusCodes.Status403Forbidden, "auth.forbidden", "You do not have permission to perform this action.");
            return;
        }

        await _default.HandleAsync(next, context, policy, authorizeResult);
    }
}

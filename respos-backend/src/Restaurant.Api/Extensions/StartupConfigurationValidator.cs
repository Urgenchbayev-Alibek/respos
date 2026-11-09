using System.Text;
using Restaurant.Infrastructure;

namespace Restaurant.Api.Extensions;

/// <summary>Fail-fast checks of required configuration, run before the host is built (clear message instead of a late crash).</summary>
public static class StartupConfigurationValidator
{
    public const int MinSigningKeyBytes = 32;

    public static IReadOnlyList<string> GetErrors(IConfiguration configuration)
    {
        var errors = new List<string>();
        if (string.IsNullOrWhiteSpace(configuration.GetConnectionString(DependencyInjection.ConnectionStringName)))
        {
            errors.Add($"ConnectionStrings:{DependencyInjection.ConnectionStringName} is missing (env ConnectionStrings__{DependencyInjection.ConnectionStringName}).");
        }

        var signingKey = configuration["Jwt:SigningKey"] ?? string.Empty;
        if (Encoding.UTF8.GetByteCount(signingKey) < MinSigningKeyBytes)
        {
            errors.Add($"Jwt:SigningKey is missing or shorter than {MinSigningKeyBytes} bytes (env Jwt__SigningKey).");
        }

        return errors;
    }

    /// <summary>Throws <see cref="InvalidOperationException"/> listing every problem.</summary>
    public static void ValidateRequiredConfiguration(this IConfiguration configuration)
    {
        var errors = GetErrors(configuration);
        if (errors.Count > 0)
        {
            throw new InvalidOperationException("Invalid configuration, refusing to start: " + string.Join(" ", errors));
        }
    }
}

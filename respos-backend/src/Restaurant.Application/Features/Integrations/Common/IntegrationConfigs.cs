using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using Restaurant.Application.Abstractions.Integrations;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Integrations.Common;

/// <summary>
/// Provider config stored encrypted in <c>IntegrationSetting.ProtectedConfig</c>. Secret fields are masked on read
/// (<see cref="SecretMask"/>) and kept unchanged on update when the client sends them empty or masked.
/// </summary>
public interface IIntegrationConfig
{
    bool IsConfigured { get; }

    /// <summary>Copy with every secret field masked (safe to return to clients / audit).</summary>
    IIntegrationConfig Masked();

    /// <summary>Copy where empty/masked secrets are taken from <paramref name="existing"/> (same type) or stay empty.</summary>
    IIntegrationConfig WithSecretsFrom(IIntegrationConfig? existing);

    /// <summary>Field → message for invalid values (enabled integrations must be complete).</summary>
    Dictionary<string, string[]> Validate(bool isEnabled);
}

/// <summary>Telegram bot for owner alerts. <see cref="DailySummaryTime"/> is <c>HH:mm</c> in each branch's timezone.</summary>
public sealed record TelegramConfig : IIntegrationConfig
{
    public string? BotToken { get; init; }
    public IReadOnlyList<string> ChatIds { get; init; } = [];
    public bool DailySummaryEnabled { get; init; } = true;
    public string DailySummaryTime { get; init; } = "21:00";
    public bool LowStockEnabled { get; init; } = true;
    public bool BigRefundEnabled { get; init; } = true;
    public decimal BigRefundThreshold { get; init; } = 500_000m;
    public bool OnlineReservationEnabled { get; init; } = true;
    public bool ShiftDifferenceEnabled { get; init; } = true;

    [JsonIgnore]
    public bool IsConfigured => !string.IsNullOrWhiteSpace(BotToken) && ChatIds.Count > 0;

    [JsonIgnore]
    public TimeOnly? DailySummaryAt =>
        TimeOnly.TryParseExact(DailySummaryTime, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var t) ? t : null;

    public IIntegrationConfig Masked() => this with { BotToken = SecretMask.Mask(BotToken) };

    public IIntegrationConfig WithSecretsFrom(IIntegrationConfig? existing) => this with
    {
        BotToken = SecretMask.Keep(BotToken, (existing as TelegramConfig)?.BotToken),
        ChatIds = ChatIds.Select(c => c.Trim()).Where(c => c.Length > 0).Distinct().ToList(),
    };

    public Dictionary<string, string[]> Validate(bool isEnabled)
    {
        var errors = new Dictionary<string, string[]>();
        if (isEnabled && string.IsNullOrWhiteSpace(BotToken))
        {
            errors["config.botToken"] = ["Bot token is required."];
        }

        if (isEnabled && ChatIds.Count == 0)
        {
            errors["config.chatIds"] = ["At least one chat id is required."];
        }

        if (ChatIds.Count > 10 || ChatIds.Any(c => c.Length > 64))
        {
            errors["config.chatIds"] = ["Up to 10 chat ids, 64 characters each."];
        }

        if (DailySummaryAt is null)
        {
            errors["config.dailySummaryTime"] = ["Use HH:mm."];
        }

        if (BigRefundThreshold < 0)
        {
            errors["config.bigRefundThreshold"] = ["Must be zero or positive."];
        }

        return errors;
    }
}

/// <summary>Eskiz.uz SMS (reservation confirmations). <see cref="From"/> is the approved sender name (default 4546).</summary>
public sealed record EskizConfig : IIntegrationConfig
{
    public string? Email { get; init; }
    public string? Password { get; init; }
    public string From { get; init; } = "4546";
    public bool ReservationConfirmationEnabled { get; init; } = true;

    [JsonIgnore]
    public bool IsConfigured => !string.IsNullOrWhiteSpace(Email) && !string.IsNullOrWhiteSpace(Password);

    public EskizCredentials Credentials() => new(Email!.Trim(), Password!, string.IsNullOrWhiteSpace(From) ? "4546" : From.Trim());

    public IIntegrationConfig Masked() => this with { Password = SecretMask.Mask(Password) };

    public IIntegrationConfig WithSecretsFrom(IIntegrationConfig? existing) =>
        this with { Password = SecretMask.Keep(Password, (existing as EskizConfig)?.Password), Email = Email?.Trim() };

    public Dictionary<string, string[]> Validate(bool isEnabled)
    {
        var errors = new Dictionary<string, string[]>();
        if (isEnabled && string.IsNullOrWhiteSpace(Email))
        {
            errors["config.email"] = ["Email is required."];
        }

        if (isEnabled && string.IsNullOrWhiteSpace(Password))
        {
            errors["config.password"] = ["Password is required."];
        }

        if (From.Length > 20)
        {
            errors["config.from"] = ["Up to 20 characters."];
        }

        return errors;
    }
}

/// <summary>Organization SMTP server for invitations / password reset e-mails (MailKit).</summary>
public sealed record SmtpConfig : IIntegrationConfig
{
    public string? Host { get; init; }
    public int Port { get; init; } = 587;
    public bool UseSsl { get; init; }
    public string? Username { get; init; }
    public string? Password { get; init; }
    public string? FromEmail { get; init; }
    public string? FromName { get; init; }

    [JsonIgnore]
    public bool IsConfigured => !string.IsNullOrWhiteSpace(Host) && !string.IsNullOrWhiteSpace(FromEmail);

    public SmtpServer Server() => new(Host!.Trim(), Port, UseSsl, Username, Password, FromEmail!.Trim(), FromName);

    public IIntegrationConfig Masked() => this with { Password = SecretMask.Mask(Password) };

    public IIntegrationConfig WithSecretsFrom(IIntegrationConfig? existing) =>
        this with { Password = SecretMask.Keep(Password, (existing as SmtpConfig)?.Password) };

    public Dictionary<string, string[]> Validate(bool isEnabled)
    {
        var errors = new Dictionary<string, string[]>();
        if (isEnabled && string.IsNullOrWhiteSpace(Host))
        {
            errors["config.host"] = ["Host is required."];
        }

        if (Port is < 1 or > 65535)
        {
            errors["config.port"] = ["Port must be 1–65535."];
        }

        if (isEnabled && (string.IsNullOrWhiteSpace(FromEmail) || !FromEmail.Contains('@')))
        {
            errors["config.fromEmail"] = ["Valid sender e-mail is required."];
        }

        return errors;
    }
}

/// <summary>JSON (de)serialization of configs per <see cref="IntegrationType"/>.</summary>
public static class IntegrationConfigCodec
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static IIntegrationConfig Default(IntegrationType type) => type switch
    {
        IntegrationType.Telegram => new TelegramConfig(),
        IntegrationType.SmsEskiz => new EskizConfig(),
        IntegrationType.Smtp => new SmtpConfig(),
        _ => throw new ArgumentOutOfRangeException(nameof(type)),
    };

    public static IIntegrationConfig? Deserialize(IntegrationType type, string json) => type switch
    {
        IntegrationType.Telegram => JsonSerializer.Deserialize<TelegramConfig>(json, Json),
        IntegrationType.SmsEskiz => JsonSerializer.Deserialize<EskizConfig>(json, Json),
        IntegrationType.Smtp => JsonSerializer.Deserialize<SmtpConfig>(json, Json),
        _ => null,
    };

    public static IIntegrationConfig? FromElement(IntegrationType type, JsonElement element) =>
        element.ValueKind == JsonValueKind.Object ? Deserialize(type, element.GetRawText()) : null;

    public static string Serialize(IIntegrationConfig config) => JsonSerializer.Serialize(config, config.GetType(), Json);
}

/// <summary>Masking: only the last 4 characters of secrets ≥ 8 chars are shown (<c>****abcd</c>); shorter → <c>****</c>.</summary>
public static class SecretMask
{
    public const string Prefix = "****";
    private const int MinLengthToReveal = 8;

    public static string? Mask(string? secret)
    {
        if (string.IsNullOrEmpty(secret))
        {
            return null;
        }

        return secret.Length >= MinLengthToReveal ? Prefix + secret[^4..] : Prefix;
    }

    public static bool IsMasked(string? value) => value is not null && value.StartsWith(Prefix, StringComparison.Ordinal);

    /// <summary>Incoming secret wins unless it is empty or a mask → the stored one is kept.</summary>
    public static string? Keep(string? incoming, string? existing) =>
        string.IsNullOrWhiteSpace(incoming) || IsMasked(incoming) ? existing : incoming.Trim();

    /// <summary>Masked recipient for logs/UI: <c>+99***67</c>, <c>a***@mail.uz</c>.</summary>
    public static string Recipient(string value)
    {
        var at = value.IndexOf('@');
        if (at > 0)
        {
            return value[0] + "***" + value[at..];
        }

        return value.Length >= 8 ? string.Concat(value.AsSpan(0, 3), "***", value.AsSpan(value.Length - 2)) : "***";
    }
}

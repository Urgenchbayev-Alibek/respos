namespace Restaurant.Application.Abstractions.Integrations;

/// <summary>Encrypts integration secrets / queued payloads at rest (ASP.NET Core Data Protection in Infrastructure).</summary>
public interface ISecretProtector
{
    string Protect(string plaintext);

    /// <summary>Null when the ciphertext cannot be decrypted (e.g. the key ring was lost) — callers treat it as "not configured".</summary>
    string? Unprotect(string protectedText);
}

/// <summary>Outcome of one delivery attempt. <see cref="Error"/> never contains secrets (tokens/passwords are scrubbed).</summary>
public sealed record DeliveryResult(bool Succeeded, string? Error = null, bool Retryable = false, TimeSpan? RetryAfter = null)
{
    public static readonly DeliveryResult Success = new(true);

    public static DeliveryResult Fail(string error, bool retryable = false, TimeSpan? retryAfter = null) =>
        new(false, error, retryable, retryAfter);
}

/// <summary>Telegram Bot API <c>sendMessage</c>.</summary>
public interface ITelegramSender
{
    Task<DeliveryResult> SendMessageAsync(string botToken, string chatId, string text, CancellationToken cancellationToken);
}

public sealed record EskizCredentials(string Email, string Password, string From);

/// <summary>Eskiz.uz SMS gateway (auth token flow + send).</summary>
public interface ISmsSender
{
    Task<DeliveryResult> SendAsync(EskizCredentials credentials, string phone, string text, CancellationToken cancellationToken);
}

public sealed record SmtpServer(string Host, int Port, bool UseSsl, string? Username, string? Password, string FromEmail, string? FromName);

public sealed record EmailContent(string To, string Subject, string TextBody, string? HtmlBody);

/// <summary>SMTP delivery (MailKit).</summary>
public interface ISmtpSender
{
    Task<DeliveryResult> SendAsync(SmtpServer server, EmailContent email, CancellationToken cancellationToken);
}

/// <summary>Platform-wide SMTP from configuration (<c>Integrations:Smtp</c>, env only) used when the organization has none.</summary>
public interface IPlatformSmtpSettings
{
    SmtpServer? Server { get; }
}

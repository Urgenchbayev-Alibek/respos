namespace Restaurant.Application.Abstractions.Email;

/// <param name="ContainsSecret">True when the body contains a token/link that must never be logged outside Development.</param>
/// <param name="HtmlBody">Optional HTML alternative (SMTP); <paramref name="Body"/> stays the plain-text part.</param>
public sealed record EmailMessage(string To, string Subject, string Body, bool ContainsSecret, string? HtmlBody = null);

public interface IEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default);
}

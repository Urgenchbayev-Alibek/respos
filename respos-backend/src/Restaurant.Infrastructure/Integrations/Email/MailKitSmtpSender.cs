using System.Net.Sockets;
using MailKit;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using Restaurant.Application.Abstractions.Integrations;

namespace Restaurant.Infrastructure.Integrations.Email;

/// <summary>SMTP delivery via MailKit (MIT). <c>UseSsl</c> → implicit TLS (465); otherwise STARTTLS when offered.</summary>
internal sealed class MailKitSmtpSender : ISmtpSender
{
    private const int TimeoutMilliseconds = 15_000;

    public async Task<DeliveryResult> SendAsync(SmtpServer server, EmailContent email, CancellationToken cancellationToken)
    {
        MimeMessage message;
        try
        {
            message = Build(server, email);
        }
        catch (ParseException)
        {
            return DeliveryResult.Fail("Invalid sender or recipient e-mail address.");
        }

        using var client = new SmtpClient { Timeout = TimeoutMilliseconds };
        try
        {
            var security = server.UseSsl ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTlsWhenAvailable;
            await client.ConnectAsync(server.Host, server.Port, security, cancellationToken);
            if (!string.IsNullOrEmpty(server.Username))
            {
                await client.AuthenticateAsync(server.Username, server.Password ?? string.Empty, cancellationToken);
            }

            await client.SendAsync(message, cancellationToken);
            await client.DisconnectAsync(quit: true, cancellationToken);
            return DeliveryResult.Success;
        }
        catch (AuthenticationException)
        {
            return DeliveryResult.Fail("SMTP authentication failed: check username and password.");
        }
        catch (SmtpCommandException ex)
        {
            var transient = (int)ex.StatusCode is >= 400 and < 500;
            return DeliveryResult.Fail(IntegrationRetry.Truncate($"SMTP {(int)ex.StatusCode}: {ex.Message}"), transient);
        }
        catch (Exception ex) when (ex is SocketException or IOException or SmtpProtocolException or SslHandshakeException or TimeoutException)
        {
            return DeliveryResult.Fail(IntegrationRetry.Truncate($"SMTP connection error: {ex.Message}"), retryable: true);
        }
    }

    internal static MimeMessage Build(SmtpServer server, EmailContent email)
    {
        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(server.FromName ?? "RestaurantOS", server.FromEmail));
        message.To.Add(MailboxAddress.Parse(email.To));
        message.Subject = email.Subject;
        message.Body = new BodyBuilder { TextBody = email.TextBody, HtmlBody = email.HtmlBody }.ToMessageBody();
        return message;
    }
}

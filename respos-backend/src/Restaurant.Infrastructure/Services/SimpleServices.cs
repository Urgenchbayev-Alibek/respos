using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Email;
using Restaurant.Application.Abstractions.Payments;
using Restaurant.Domain.Entities.Payments;

namespace Restaurant.Infrastructure.Services;

internal sealed class SystemClock : IClock
{
    public DateTime UtcNow => DateTime.UtcNow;
}

/// <summary>Demo provider: the cashier marks the payment manually; always succeeds. UI: "Ручная отметка (демо)".</summary>
internal sealed class ManualPaymentProvider : IPaymentProvider
{
    public string Code => Payment.ManualProvider;

    public Task<PaymentProviderResult> ChargeAsync(PaymentProviderRequest request, CancellationToken cancellationToken = default) =>
        Task.FromResult(new PaymentProviderResult(true, request.ExternalReference, null));

    public Task<PaymentProviderResult> RefundAsync(PaymentProviderRequest request, CancellationToken cancellationToken = default) =>
        Task.FromResult(new PaymentProviderResult(true, request.ExternalReference, null));
}

/// <summary>Stub e-mail provider: writes to the log. Bodies with secrets (tokens/links) are logged only in Development.</summary>
internal sealed class LogEmailSender(ILogger<LogEmailSender> logger, IHostEnvironment environment) : IEmailSender
{
    public Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        if (message.ContainsSecret && !environment.IsDevelopment())
        {
            logger.LogInformation("Email would be sent to {To}: {Subject} (body hidden: contains a secret)", message.To, message.Subject);
        }
        else
        {
            logger.LogInformation("Email would be sent to {To}: {Subject}\n{Body}", message.To, message.Subject, message.Body);
        }

        return Task.CompletedTask;
    }
}

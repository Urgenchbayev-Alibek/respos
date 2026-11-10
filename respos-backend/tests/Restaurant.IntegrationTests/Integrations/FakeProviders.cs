using System.Collections.Concurrent;
using Microsoft.AspNetCore.TestHost;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Restaurant.Application.Abstractions.Integrations;
using Restaurant.IntegrationTests.Infrastructure;

namespace Restaurant.IntegrationTests.Integrations;

/// <summary>Records every delivery; <see cref="Next"/> decides the result (default: success).</summary>
public sealed class FakeProviders : ITelegramSender, ISmsSender, ISmtpSender
{
    public sealed record Sent(string Channel, string Recipient, string Text);

    public ConcurrentQueue<Sent> Deliveries { get; } = new();

    public Func<DeliveryResult> Next { get; set; } = () => DeliveryResult.Success;

    public Task<DeliveryResult> SendMessageAsync(string botToken, string chatId, string text, CancellationToken cancellationToken) =>
        Record("telegram", chatId, text);

    public Task<DeliveryResult> SendAsync(EskizCredentials credentials, string phone, string text, CancellationToken cancellationToken) =>
        Record("sms", phone, text);

    public Task<DeliveryResult> SendAsync(SmtpServer server, EmailContent email, CancellationToken cancellationToken) =>
        Record("email", email.To, email.TextBody);

    private Task<DeliveryResult> Record(string channel, string recipient, string text)
    {
        Deliveries.Enqueue(new Sent(channel, recipient, text));
        return Task.FromResult(Next());
    }
}

/// <summary>
/// One extra API host (same DB / clock) whose Telegram, SMS and SMTP providers are <see cref="FakeProviders"/>.
/// Created once per test run; tests in the api collection run sequentially, so they reset <see cref="FakeProviders.Next"/>.
/// </summary>
public static class FakeProviderHost
{
    private static readonly object Gate = new();
    private static WebApplicationFactory<Program>? _host;

    public static FakeProviders Providers { get; } = new();

    public static WebApplicationFactory<Program> Get(ApiFactory factory)
    {
        lock (Gate)
        {
            return _host ??= factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<ITelegramSender>();
                services.RemoveAll<ISmsSender>();
                services.RemoveAll<ISmtpSender>();
                services.AddSingleton<ITelegramSender>(Providers);
                services.AddSingleton<ISmsSender>(Providers);
                services.AddSingleton<ISmtpSender>(Providers);
            }));
        }
    }
}

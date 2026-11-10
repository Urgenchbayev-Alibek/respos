using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Restaurant.Application.Features.Integrations.Alerts;
using Restaurant.Application.Features.Integrations.Outbound;

namespace Restaurant.Infrastructure.Integrations.Background;

/// <summary>
/// Periodic job (same pattern as Housekeeping): runs <see cref="RunOnceAsync"/> in a fresh scope every interval;
/// failures are logged and retried on the next tick. Disabled with <c>Integrations:BackgroundEnabled=false</c>.
/// </summary>
internal abstract class PeriodicIntegrationService(
    IServiceScopeFactory scopeFactory, IOptions<IntegrationsOptions> options, ILogger logger) : BackgroundService
{
    protected IntegrationsOptions Options => options.Value;

    protected abstract TimeSpan Interval { get; }

    protected abstract string Name { get; }

    protected abstract Task RunOnceAsync(IServiceProvider services, CancellationToken cancellationToken);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!options.Value.BackgroundEnabled)
        {
            logger.LogInformation("{Job} is disabled", Name);
            return;
        }

        using var timer = new PeriodicTimer(Interval);
        do
        {
            await TickAsync(stoppingToken);
        }
        while (await WaitAsync(timer, stoppingToken));
    }

    private async Task TickAsync(CancellationToken stoppingToken)
    {
        try
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            await RunOnceAsync(scope.ServiceProvider, stoppingToken);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            logger.LogDebug("{Job} stopped", Name);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "{Job} run failed; will retry on the next tick", Name);
        }
    }

    private static async Task<bool> WaitAsync(PeriodicTimer timer, CancellationToken stoppingToken)
    {
        try
        {
            return await timer.WaitForNextTickAsync(stoppingToken);
        }
        catch (OperationCanceledException)
        {
            return false;
        }
    }
}

/// <summary>Delivers due outbound messages; purges finished rows older than <c>RetentionDays</c> about once an hour.</summary>
internal sealed class OutboundDispatcherService(
    IServiceScopeFactory scopeFactory, IOptions<IntegrationsOptions> options, ILogger<OutboundDispatcherService> logger)
    : PeriodicIntegrationService(scopeFactory, options, logger)
{
    private DateTime _lastPurge = DateTime.MinValue;

    protected override TimeSpan Interval => TimeSpan.FromSeconds(Math.Max(1, Options.DispatcherIntervalSeconds));

    protected override string Name => "Outbound dispatcher";

    protected override async Task RunOnceAsync(IServiceProvider services, CancellationToken cancellationToken)
    {
        var dispatcher = services.GetRequiredService<OutboundDispatcher>();
        await dispatcher.RunOnceAsync(Math.Max(1, Options.DispatcherBatchSize), cancellationToken);
        if (DateTime.UtcNow - _lastPurge > TimeSpan.FromHours(1))
        {
            _lastPurge = DateTime.UtcNow;
            await dispatcher.PurgeAsync(TimeSpan.FromDays(Math.Max(1, Options.RetentionDays)), cancellationToken);
        }
    }
}

/// <summary>Queues daily Telegram summaries for branches whose local time passed the configured time (idempotent per day).</summary>
internal sealed class DailySummaryService(
    IServiceScopeFactory scopeFactory, IOptions<IntegrationsOptions> options, ILogger<DailySummaryService> logger)
    : PeriodicIntegrationService(scopeFactory, options, logger)
{
    protected override TimeSpan Interval => TimeSpan.FromSeconds(Math.Max(10, Options.DailySummaryIntervalSeconds));

    protected override string Name => "Daily summary";

    protected override Task RunOnceAsync(IServiceProvider services, CancellationToken cancellationToken) =>
        services.GetRequiredService<DailySummaryJob>().RunAsync(cancellationToken);
}

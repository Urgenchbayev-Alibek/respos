using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Restaurant.Infrastructure.Housekeeping;

/// <summary>
/// Runs <see cref="HousekeepingCleaner"/> on start and then every <c>Housekeeping:IntervalMinutes</c>.
/// A failed run is logged and retried on the next tick — it never stops the host.
/// </summary>
internal sealed class HousekeepingService(
    IServiceScopeFactory scopeFactory,
    IOptions<HousekeepingOptions> options,
    ILogger<HousekeepingService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!options.Value.Enabled)
        {
            logger.LogInformation("Housekeeping is disabled");
            return;
        }

        var interval = TimeSpan.FromMinutes(Math.Max(1, options.Value.IntervalMinutes));
        using var timer = new PeriodicTimer(interval);
        do
        {
            await RunOnceAsync(stoppingToken);
        }
        while (await WaitAsync(timer, stoppingToken));
    }

    private async Task RunOnceAsync(CancellationToken stoppingToken)
    {
        try
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            await scope.ServiceProvider.GetRequiredService<HousekeepingCleaner>().RunAsync(stoppingToken);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // host is stopping
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Housekeeping run failed; will retry on the next tick");
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

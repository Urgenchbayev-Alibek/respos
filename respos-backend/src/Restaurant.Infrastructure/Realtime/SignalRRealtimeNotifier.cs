using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using Restaurant.Application.Abstractions.Realtime;

namespace Restaurant.Infrastructure.Realtime;

/// <summary>Flushes queued realtime messages after a successful commit.</summary>
public interface IRealtimeFlusher
{
    Task FlushAsync(CancellationToken cancellationToken);
}

/// <summary>
/// Request-scoped queue of SignalR messages. <see cref="Enqueue"/> only buffers; the DbContext calls
/// <see cref="FlushAsync"/> after the transaction commits. Delivery failures are logged, never thrown
/// (clients refetch from REST anyway). Registered by the API with its hub type.
/// </summary>
public sealed class SignalRRealtimeNotifier<THub>(IHubContext<THub> hub, ILogger<SignalRRealtimeNotifier<THub>> logger)
    : IRealtimeNotifier, IRealtimeFlusher
    where THub : Hub
{
    private readonly List<RealtimeMessage> _pending = [];

    public void Enqueue(RealtimeMessage message) => _pending.Add(message);

    public async Task FlushAsync(CancellationToken cancellationToken)
    {
        if (_pending.Count == 0)
        {
            return;
        }

        var batch = _pending.ToList();
        _pending.Clear();
        foreach (var message in batch)
        {
            try
            {
                await hub.Clients.Group(message.Group).SendAsync(message.Event, message.Payload, CancellationToken.None);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(ex, "Realtime event {Event} to {Group} was not delivered", message.Event, message.Group);
            }
        }
    }
}

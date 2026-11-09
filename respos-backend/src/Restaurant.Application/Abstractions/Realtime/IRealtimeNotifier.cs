namespace Restaurant.Application.Abstractions.Realtime;

/// <summary>A SignalR message to a group. Payload should include <c>branchId</c> and <c>occurredAt</c> (REALTIME.md).</summary>
public sealed record RealtimeMessage(string Group, string Event, object Payload);

/// <summary>
/// Queues realtime notifications. Messages are delivered only AFTER the unit of work commits
/// (IApplicationDbContext.SaveChangesAsync / ExecuteInTransactionAsync); dropped if the save fails.
/// </summary>
public interface IRealtimeNotifier
{
    void Enqueue(RealtimeMessage message);
}

public static class RealtimeGroups
{
    public static string Branch(Guid branchId) => $"branch:{branchId}";

    public static string Kitchen(Guid branchId) => $"branch:{branchId}:kitchen";

    public static string Station(Guid branchId, Guid stationId) => $"branch:{branchId}:station:{stationId}";

    public static string User(Guid userId) => $"user:{userId}";
}

/// <summary>Server → client event names (REALTIME.md).</summary>
public static class RealtimeEvents
{
    public const string KitchenTicketCreated = "KitchenTicketCreated";
    public const string KitchenTicketUpdated = "KitchenTicketUpdated";
    public const string OrderUpdated = "OrderUpdated";
    public const string OrderItemReady = "OrderItemReady";
    public const string TableUpdated = "TableUpdated";
    public const string PaymentRegistered = "PaymentRegistered";
    public const string NotificationCreated = "NotificationCreated";
    public const string StockLow = "StockLow";
}

public static class RealtimeNotifierExtensions
{
    public static void ToBranch(this IRealtimeNotifier notifier, Guid branchId, string eventName, object payload) =>
        notifier.Enqueue(new RealtimeMessage(RealtimeGroups.Branch(branchId), eventName, payload));

    /// <summary>Sends to the all-stations kitchen group and, when given, the station group.</summary>
    public static void ToKitchen(this IRealtimeNotifier notifier, Guid branchId, Guid? stationId, string eventName, object payload)
    {
        notifier.Enqueue(new RealtimeMessage(RealtimeGroups.Kitchen(branchId), eventName, payload));
        if (stationId is { } station)
        {
            notifier.Enqueue(new RealtimeMessage(RealtimeGroups.Station(branchId, station), eventName, payload));
        }
    }

    public static void ToUser(this IRealtimeNotifier notifier, Guid userId, string eventName, object payload) =>
        notifier.Enqueue(new RealtimeMessage(RealtimeGroups.User(userId), eventName, payload));
}

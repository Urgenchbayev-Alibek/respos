using Restaurant.Domain.Enums;

namespace Restaurant.Application.Abstractions.Notifications;

/// <summary>Content of an in-app notification. <see cref="OrganizationId"/> is explicit (handlers may run without tenant).</summary>
public sealed record NotificationMessage(
    Guid OrganizationId, Guid? BranchId, NotificationType Type, string Title, string? Body = null, string? Link = null);

/// <summary>
/// Creates Notification rows in the current unit of work (caller / outer SaveChanges commits) and queues the realtime
/// <c>NotificationCreated</c> event to each recipient's <c>user:{id}</c> group (sent after commit).
/// </summary>
public interface INotificationPublisher
{
    /// <summary>One notification for one user.</summary>
    void PublishToUser(NotificationMessage message, Guid userId);

    /// <summary>
    /// One notification per active member who has <paramref name="permission"/> and <c>notifications.read</c>
    /// and can access the message branch (owner/admin: every branch). <paramref name="excludeUserId"/> (the actor) is skipped.
    /// Returns the number of recipients.
    /// </summary>
    Task<int> PublishToPermissionAsync(NotificationMessage message, string permission, Guid? excludeUserId, CancellationToken cancellationToken);
}

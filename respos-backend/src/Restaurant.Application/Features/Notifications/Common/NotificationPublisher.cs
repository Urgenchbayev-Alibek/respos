using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Notifications;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Abstractions.Realtime;
using Restaurant.Domain.Constants;
using Restaurant.Domain.Entities.Notifications;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Notifications.Common;

/// <summary>Fan-out publisher: one row per recipient (per-user read state stays simple). Never saves.</summary>
internal sealed class NotificationPublisher(IApplicationDbContext db, IRealtimeNotifier realtime, IClock clock) : INotificationPublisher
{
    public void PublishToUser(NotificationMessage message, Guid userId)
    {
        var now = clock.UtcNow;
        var notification = new Notification
        {
            OrganizationId = message.OrganizationId,
            BranchId = message.BranchId,
            UserId = userId,
            Type = message.Type,
            Title = Truncate(message.Title, 200)!,
            Body = Truncate(message.Body, 2000),
            Link = message.Link,
            CreatedAt = now,
        };
        db.Notifications.Add(notification);
        realtime.ToUser(userId, RealtimeEvents.NotificationCreated, new
        {
            notificationId = notification.Id,
            type = notification.Type,
            title = notification.Title,
            branchId = notification.BranchId,
            occurredAt = now,
        });
    }

    public async Task<int> PublishToPermissionAsync(
        NotificationMessage message, string permission, Guid? excludeUserId, CancellationToken cancellationToken)
    {
        message = await WithOrganizationAsync(message, cancellationToken);
        var recipients = await RecipientsAsync(message.OrganizationId, message.BranchId, permission, cancellationToken);
        foreach (var userId in recipients.Where(id => id != excludeUserId))
        {
            PublishToUser(message, userId);
        }

        return recipients.Count(id => id != excludeUserId);
    }

    /// <summary>Entities added in the same unit of work get their OrganizationId only at save → resolve it via the branch.</summary>
    private async Task<NotificationMessage> WithOrganizationAsync(NotificationMessage message, CancellationToken ct)
    {
        if (message.OrganizationId != Guid.Empty || message.BranchId is not { } branchId)
        {
            return message;
        }

        var organizationId = db.Branches.Local.FirstOrDefault(b => b.Id == branchId)?.OrganizationId
                             ?? await db.Branches.IgnoreQueryFilters().Where(b => b.Id == branchId).Select(b => b.OrganizationId).FirstOrDefaultAsync(ct);
        return message with { OrganizationId = organizationId };
    }

    private Task<List<Guid>> RecipientsAsync(Guid organizationId, Guid? branchId, string permission, CancellationToken ct)
    {
        const string read = Permissions.Notifications.Read;
        var allBranchRoles = SystemRoles.AllBranchRoles.ToArray();
        var roles = db.UserRoles.IgnoreQueryFilters().Where(ur => ur.OrganizationId == organizationId);
        return db.UserOrganizations.IgnoreQueryFilters()
            .Where(uo => uo.OrganizationId == organizationId && uo.IsActive && uo.User!.Status == UserStatus.Active)
            .Select(uo => uo.UserId)
            .Where(userId => roles.Any(ur => ur.UserId == userId && ur.Role!.Permissions.Any(p => p.PermissionCode == permission))
                             && roles.Any(ur => ur.UserId == userId && ur.Role!.Permissions.Any(p => p.PermissionCode == read)))
            .Where(userId => branchId == null
                             || roles.Any(ur => ur.UserId == userId && allBranchRoles.Contains(ur.Role!.Code))
                             || db.UserBranchAccesses.IgnoreQueryFilters()
                                 .Any(a => a.OrganizationId == organizationId && a.UserId == userId && a.BranchId == branchId))
            .Distinct()
            .ToListAsync(ct);
    }

    private static string? Truncate(string? value, int max) =>
        value is null || value.Length <= max ? value : value[..max];
}

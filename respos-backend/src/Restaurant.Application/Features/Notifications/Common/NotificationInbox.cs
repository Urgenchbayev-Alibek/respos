using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Notifications;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Notifications.Common;

public sealed record NotificationDto(
    Guid Id, NotificationType Type, string Title, string? Body, string? Link, Guid? BranchId, bool IsRead, DateTime CreatedAt, DateTime? ReadAt);

public sealed record CountDto(int Count);

public static class NotificationErrors
{
    public static readonly Error NotFound = Error.NotFound("notification.not_found", "Notification not found.");
}

/// <summary>
/// The current user's notifications in the current organization (tenant filter): addressed to the user, or broadcast
/// (UserId null) for the organization / a branch the user can access.
/// </summary>
[ScopedService]
public sealed class NotificationInbox(IApplicationDbContext db, ITenantContext tenant)
{
    public Guid UserId => tenant.RequireUserId();

    public IQueryable<Notification> Visible()
    {
        tenant.RequireOrganizationId();
        var userId = tenant.RequireUserId();
        return db.Notifications.Where(n => n.UserId == userId || n.UserId == null);
    }

    public IQueryable<Notification> Unread()
    {
        var userId = UserId;
        return Visible().Where(n => !db.NotificationReads.Any(r => r.NotificationId == n.Id && r.UserId == userId));
    }

    public IQueryable<NotificationDto> Project(IQueryable<Notification> query)
    {
        var userId = UserId;
        return query.Select(n => new NotificationDto(
            n.Id, n.Type, n.Title, n.Body, n.Link, n.BranchId,
            db.NotificationReads.Any(r => r.NotificationId == n.Id && r.UserId == userId),
            n.CreatedAt,
            db.NotificationReads.Where(r => r.NotificationId == n.Id && r.UserId == userId).Select(r => (DateTime?)r.ReadAt).FirstOrDefault()));
    }
}

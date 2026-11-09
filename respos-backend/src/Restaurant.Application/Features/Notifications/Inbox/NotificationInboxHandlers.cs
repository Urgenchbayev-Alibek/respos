using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Extensions;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Common.Models;
using Restaurant.Application.Features.Notifications.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Notifications;

namespace Restaurant.Application.Features.Notifications.Inbox;

/// <summary><c>GET /notifications?unreadOnly=&amp;page=&amp;pageSize=</c> — newest first.</summary>
public sealed record ListNotificationsQuery : PageQuery
{
    public bool UnreadOnly { get; init; }
}

public sealed class ListNotificationsHandler(NotificationInbox inbox) : IHandler<ListNotificationsQuery, PagedResult<NotificationDto>>
{
    public async Task<Result<PagedResult<NotificationDto>>> HandleAsync(ListNotificationsQuery request, CancellationToken cancellationToken)
    {
        var query = request.UnreadOnly ? inbox.Unread() : inbox.Visible();
        var ordered = query.OrderByDescending(n => n.CreatedAt).ThenByDescending(n => n.Id);
        return await inbox.Project(ordered).ToPagedResultAsync(request, cancellationToken);
    }
}

public sealed record UnreadCountQuery;

public sealed class UnreadCountHandler(NotificationInbox inbox) : IHandler<UnreadCountQuery, CountDto>
{
    public async Task<Result<CountDto>> HandleAsync(UnreadCountQuery request, CancellationToken cancellationToken) =>
        new CountDto(await inbox.Unread().CountAsync(cancellationToken));
}

public sealed record MarkNotificationReadCommand(Guid Id);

/// <summary><c>POST /notifications/{id}/read</c> — idempotent; other users' / other tenants' ids → 404.</summary>
public sealed class MarkNotificationReadHandler(IApplicationDbContext db, NotificationInbox inbox, IClock clock)
    : IHandler<MarkNotificationReadCommand, NotificationDto>
{
    public async Task<Result<NotificationDto>> HandleAsync(MarkNotificationReadCommand request, CancellationToken cancellationToken)
    {
        if (!await inbox.Visible().AnyAsync(n => n.Id == request.Id, cancellationToken))
        {
            return NotificationErrors.NotFound;
        }

        var userId = inbox.UserId;
        if (!await db.NotificationReads.AnyAsync(r => r.NotificationId == request.Id && r.UserId == userId, cancellationToken))
        {
            db.NotificationReads.Add(new NotificationRead { NotificationId = request.Id, UserId = userId, ReadAt = clock.UtcNow });
            await db.SaveChangesAsync(cancellationToken);
        }

        return await inbox.Project(inbox.Visible().Where(n => n.Id == request.Id)).FirstAsync(cancellationToken);
    }
}

public sealed record MarkAllNotificationsReadCommand;

/// <summary><c>POST /notifications/read-all</c> → <c>{ count }</c> of newly read notifications.</summary>
public sealed class MarkAllNotificationsReadHandler(IApplicationDbContext db, NotificationInbox inbox, IClock clock)
    : IHandler<MarkAllNotificationsReadCommand, CountDto>
{
    public async Task<Result<CountDto>> HandleAsync(MarkAllNotificationsReadCommand request, CancellationToken cancellationToken)
    {
        var userId = inbox.UserId;
        var ids = await inbox.Unread().Select(n => n.Id).ToListAsync(cancellationToken);
        var now = clock.UtcNow;
        db.NotificationReads.AddRange(ids.Select(id => new NotificationRead { NotificationId = id, UserId = userId, ReadAt = now }));
        await db.SaveChangesAsync(cancellationToken);
        return new CountDto(ids.Count);
    }
}

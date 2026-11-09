using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Authorization;
using Restaurant.Application.Common.Models;
using Restaurant.Application.Features.Audit;
using Restaurant.Application.Features.Notifications.Common;
using Restaurant.Application.Features.Notifications.Inbox;
using Restaurant.Domain.Constants;

namespace Restaurant.Api.Controllers;

/// <summary>Current user's in-app notifications (org-level, per-user read state).</summary>
[Route(RoutePrefix + "notifications")]
[HasPermission(Permissions.Notifications.Read)]
public sealed class NotificationsController : ApiControllerBase
{
    [HttpGet]
    [ProducesResponseType<PagedResult<NotificationDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromQuery] ListNotificationsQuery query, [FromServices] ListNotificationsHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(query, ct));

    [HttpGet("unread-count")]
    [ProducesResponseType<CountDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> UnreadCount([FromServices] UnreadCountHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new UnreadCountQuery(), ct));

    [HttpPost("{id:guid}/read")]
    [ProducesResponseType<NotificationDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> MarkRead(Guid id, [FromServices] MarkNotificationReadHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new MarkNotificationReadCommand(id), ct));

    [HttpPost("read-all")]
    [ProducesResponseType<CountDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> MarkAllRead([FromServices] MarkAllNotificationsReadHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new MarkAllNotificationsReadCommand(), ct));
}

/// <summary>Append-only audit log of the current organization (read API only — no update/delete endpoints).</summary>
[Route(RoutePrefix + "audit-logs")]
[HasPermission(Permissions.Audit.Read)]
public sealed class AuditLogsController : ApiControllerBase
{
    [HttpGet]
    [ProducesResponseType<PagedResult<AuditLogDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromQuery] ListAuditLogsQuery query, [FromServices] ListAuditLogsHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(query, ct));
}

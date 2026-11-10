using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Abstractions.Realtime;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Orders.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Delivery;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.PublicMenu.WaiterCalls;

public sealed record WaiterCallDto(
    Guid Id,
    Guid TableId,
    string TableNumber,
    WaiterCallReason Reason,
    WaiterCallStatus Status,
    DateTime CreatedAt,
    DateTime? AcknowledgedAt,
    Guid? AcknowledgedBy,
    string? AcknowledgedByName);

public sealed record ListWaiterCallsQuery;

public sealed record AcknowledgeWaiterCallCommand(Guid CallId);

/// <summary><c>GET /waiter-calls</c>: active calls of the current branch from the last 12 hours, oldest first.</summary>
public sealed class ListWaiterCallsHandler(IApplicationDbContext db, ITenantContext tenant, IClock clock)
    : IHandler<ListWaiterCallsQuery, IReadOnlyList<WaiterCallDto>>
{
    public static readonly TimeSpan ActiveWindow = TimeSpan.FromHours(12);

    public async Task<Result<IReadOnlyList<WaiterCallDto>>> HandleAsync(ListWaiterCallsQuery request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        var since = clock.UtcNow - ActiveWindow;
        var calls = await db.WaiterCalls.AsNoTracking()
            .Where(c => c.BranchId == branchId && c.Status == WaiterCallStatus.Active && c.CreatedAt >= since)
            .OrderBy(c => c.CreatedAt)
            .Take(200)
            .ToListAsync(cancellationToken);
        IReadOnlyList<WaiterCallDto> result = calls.Select(c => WaiterCallMapper.ToDto(c, null)).ToList();
        return Result.Success(result);
    }
}

/// <summary><c>POST /waiter-calls/{id}/acknowledge</c> (idempotent) → realtime <c>WaiterCallUpdated</c>.</summary>
public sealed class AcknowledgeWaiterCallHandler(
    IApplicationDbContext db, ITenantContext tenant, IClock clock, IRealtimeNotifier realtime, UserNameLookup users)
    : IHandler<AcknowledgeWaiterCallCommand, WaiterCallDto>
{
    public async Task<Result<WaiterCallDto>> HandleAsync(AcknowledgeWaiterCallCommand request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        var userId = tenant.RequireUserId();
        var call = await db.WaiterCalls.FirstOrDefaultAsync(c => c.Id == request.CallId && c.BranchId == branchId, cancellationToken);
        if (call is null)
        {
            return DeliveryErrors.WaiterCallNotFound;
        }

        var now = clock.UtcNow;
        call.Acknowledge(userId, now);
        realtime.ToBranch(branchId, RealtimeEvents.WaiterCallUpdated, new
        {
            callId = call.Id,
            tableId = call.TableId,
            status = call.Status,
            branchId,
            occurredAt = now,
        });
        await db.SaveChangesAsync(cancellationToken);
        var names = await users.GetAsync([call.AcknowledgedBy], cancellationToken);
        return WaiterCallMapper.ToDto(call, call.AcknowledgedBy is { } by ? names.GetValueOrDefault(by) : null);
    }
}

internal static class WaiterCallMapper
{
    public static WaiterCallDto ToDto(WaiterCall c, string? acknowledgedByName) =>
        new(c.Id, c.TableId, c.TableNumber, c.Reason, c.Status, c.CreatedAt, c.AcknowledgedAt, c.AcknowledgedBy, acknowledgedByName);
}

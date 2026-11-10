using System.Text.Json.Serialization;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Notifications;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Abstractions.Realtime;
using Restaurant.Application.Common.Handlers;
using Restaurant.Domain.Common;
using Restaurant.Domain.Constants;
using Restaurant.Domain.Entities.Delivery;
using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.PublicMenu.WaiterCalls;

public sealed record CallWaiterCommand(string TableNumber, WaiterCallReason Reason)
{
    [JsonIgnore]
    public string BranchSlug { get; init; } = string.Empty;
}

public sealed class CallWaiterValidator : AbstractValidator<CallWaiterCommand>
{
    public CallWaiterValidator()
    {
        RuleFor(x => x.TableNumber).NotEmpty().MaximumLength(20);
        RuleFor(x => x.Reason).IsInEnum();
    }
}

/// <summary>Public answer of the call-waiter endpoint (no internal ids except the call id).</summary>
public sealed record PublicWaiterCallDto(Guid Id, string TableNumber, WaiterCallReason Reason, WaiterCallStatus Status, DateTime CreatedAt);

/// <summary>
/// <c>POST /public/menu/{branchSlug}/call-waiter</c> (anonymous, rate-limited per IP+table in the API): validates that the
/// table exists in that branch, creates a <see cref="WaiterCall"/> (an active call for the same table+reason is reused —
/// no duplicate alerts), queues realtime <c>WaiterCalled</c> to the branch and a <c>waiter_called</c> notification to
/// branch staff with <c>orders.update</c> (waiters, managers, owners/admins).
/// </summary>
public sealed class CallWaiterHandler(IApplicationDbContext db, IClock clock, IRealtimeNotifier realtime, INotificationPublisher notifications)
    : IHandler<CallWaiterCommand, PublicWaiterCallDto>
{
    public async Task<Result<PublicWaiterCallDto>> HandleAsync(CallWaiterCommand request, CancellationToken cancellationToken)
    {
        var slug = request.BranchSlug.Trim().ToLowerInvariant();
        var branch = await db.Branches.IgnoreQueryFilters().AsNoTracking()
            .Where(b => b.Slug == slug && b.IsActive && b.Organization!.Status == OrganizationStatus.Active)
            .Select(b => new { b.Id, b.OrganizationId })
            .FirstOrDefaultAsync(cancellationToken);
        if (branch is null)
        {
            return DeliveryErrors.MenuNotFound;
        }

        var number = request.TableNumber.Trim();
        var table = await db.DiningTables.IgnoreQueryFilters().AsNoTracking()
            .Where(t => t.OrganizationId == branch.OrganizationId && t.BranchId == branch.Id && t.Number == number && !t.IsArchived)
            .Select(t => new { t.Id, t.Number })
            .FirstOrDefaultAsync(cancellationToken);
        if (table is null)
        {
            return OrderErrors.TableNotFound;
        }

        var now = clock.UtcNow;
        var since = now - ListWaiterCallsHandler.ActiveWindow;
        var existing = await db.WaiterCalls.IgnoreQueryFilters().AsNoTracking()
            .FirstOrDefaultAsync(c => c.BranchId == branch.Id && c.TableId == table.Id && c.Reason == request.Reason
                                      && c.Status == WaiterCallStatus.Active && c.CreatedAt >= since, cancellationToken);
        if (existing is not null)
        {
            return ToDto(existing);
        }

        var call = WaiterCall.Create(branch.OrganizationId, branch.Id, table.Id, table.Number, request.Reason, now);
        db.WaiterCalls.Add(call);
        realtime.ToBranch(branch.Id, RealtimeEvents.WaiterCalled, new
        {
            callId = call.Id,
            tableId = call.TableId,
            tableNumber = call.TableNumber,
            reason = call.Reason,
            branchId = branch.Id,
            occurredAt = now,
        });
        var title = request.Reason == WaiterCallReason.Bill ? $"Стол {table.Number}: просят счёт" : $"Стол {table.Number}: вызов официанта";
        await notifications.PublishToPermissionAsync(
            new NotificationMessage(branch.OrganizationId, branch.Id, NotificationType.WaiterCalled, title, "QR-меню", "/waiter"),
            Permissions.Orders.Update, null, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        return ToDto(call);
    }

    private static PublicWaiterCallDto ToDto(WaiterCall c) => new(c.Id, c.TableNumber, c.Reason, c.Status, c.CreatedAt);
}

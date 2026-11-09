using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Kitchen.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Kitchen;

namespace Restaurant.Application.Features.Kitchen.UpdateTicketStatus;

public enum TicketAction { Start, Ready, Served, Recall }

public sealed record UpdateTicketStatusCommand(Guid TicketId, TicketAction Action);

public enum TicketItemAction { Start, Ready }

public sealed record UpdateTicketItemStatusCommand(Guid TicketItemId, TicketItemAction Action);

/// <summary>
/// <c>POST /kitchen/tickets/{id}/start|ready|served|recall</c>: changes the ticket, mirrors the order items
/// (ticket item new→sent, preparing→preparing, ready→ready; served → order items served) and recomputes the order status.
/// </summary>
public sealed class UpdateTicketStatusHandler(IApplicationDbContext db, ITenantContext tenant, KitchenOrderSync sync)
    : IHandler<UpdateTicketStatusCommand, KitchenTicketDto>
{
    public async Task<Result<KitchenTicketDto>> HandleAsync(UpdateTicketStatusCommand request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        var ticket = await db.KitchenTickets.Include(t => t.Items)
            .FirstOrDefaultAsync(t => t.Id == request.TicketId && t.BranchId == branchId, cancellationToken);
        if (ticket is null)
        {
            return KitchenErrors.TicketNotFound;
        }

        return await sync.ApplyAsync(ticket, (order, now) => request.Action switch
        {
            TicketAction.Start => sync.StartItems(order, ticket.Start(now), now),
            TicketAction.Ready => sync.ReadyItems(order, ticket.MarkReady(now), now),
            TicketAction.Served => sync.ServeTicket(order, ticket, now),
            TicketAction.Recall => sync.RecallItems(order, ticket.Recall(), now),
            _ => throw new ArgumentOutOfRangeException(nameof(request)),
        }, cancellationToken);
    }
}

/// <summary><c>POST /kitchen/ticket-items/{id}/start|ready</c>: per-item progress; the ticket follows its items.</summary>
public sealed class UpdateTicketItemStatusHandler(IApplicationDbContext db, ITenantContext tenant, KitchenOrderSync sync)
    : IHandler<UpdateTicketItemStatusCommand, KitchenTicketDto>
{
    public async Task<Result<KitchenTicketDto>> HandleAsync(UpdateTicketItemStatusCommand request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        var ticket = await db.KitchenTickets.Include(t => t.Items)
            .FirstOrDefaultAsync(t => t.BranchId == branchId && t.Items.Any(i => i.Id == request.TicketItemId), cancellationToken);
        if (ticket is null)
        {
            return KitchenErrors.TicketItemNotFound;
        }

        return await sync.ApplyAsync(ticket, (order, now) => request.Action switch
        {
            TicketItemAction.Start => sync.StartItems(order, [ticket.StartItem(request.TicketItemId, now)], now),
            TicketItemAction.Ready => sync.ReadyItems(order, [ticket.MarkItemReady(request.TicketItemId, now)], now),
            _ => throw new ArgumentOutOfRangeException(nameof(request)),
        }, cancellationToken);
    }
}

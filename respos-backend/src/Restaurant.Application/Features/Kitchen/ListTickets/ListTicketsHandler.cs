using Restaurant.Application.Common.Extensions;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Kitchen.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Kitchen.ListTickets;

/// <summary><c>GET /kitchen/tickets?stationId=&amp;status=new,in_progress,ready</c> (default statuses = open ones).</summary>
public sealed record ListTicketsQuery
{
    public Guid? StationId { get; init; }
    public string? Status { get; init; }
}

/// <summary>KDS list sorted by createdAt ascending (oldest first, BR-15.3). Plain array.</summary>
public sealed class ListTicketsHandler(KitchenTicketReadService reader) : IHandler<ListTicketsQuery, IReadOnlyList<KitchenTicketDto>>
{
    private const int MaxTickets = 300;

    private static readonly KitchenTicketStatus[] DefaultStatuses =
        [KitchenTicketStatus.New, KitchenTicketStatus.InProgress, KitchenTicketStatus.Ready];

    public async Task<Result<IReadOnlyList<KitchenTicketDto>>> HandleAsync(ListTicketsQuery request, CancellationToken cancellationToken)
    {
        var parsed = SnakeCaseEnum.ParseList<KitchenTicketStatus>(request.Status);
        var statuses = parsed.Count > 0 ? parsed.ToArray() : DefaultStatuses;
        var query = reader.BranchTickets().Where(t => statuses.Contains(t.Status));
        if (request.StationId is { } stationId)
        {
            query = query.Where(t => t.KitchenStationId == stationId);
        }

        var tickets = await query
            .Include(t => t.Items)
            .Include(t => t.KitchenStation)
            .OrderBy(t => t.CreatedAt)
            .Take(MaxTickets)
            .AsSplitQuery()
            .ToListAsync(cancellationToken);
        return Result.Success(await reader.MapAsync(tickets, cancellationToken));
    }
}

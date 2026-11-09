using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Common.Extensions;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Common.Models;
using Restaurant.Application.Features.Orders.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Orders.GetOrders;

public sealed record GetOrderQuery(Guid OrderId);

public sealed class GetOrderHandler(OrderWriter writer) : IHandler<GetOrderQuery, OrderDto>
{
    public Task<Result<OrderDto>> HandleAsync(GetOrderQuery request, CancellationToken cancellationToken) =>
        writer.ReadAsync(request.OrderId, cancellationToken);
}

/// <summary><c>GET /orders?status=a,b&amp;tableId=&amp;waiterId=&amp;from=&amp;to=&amp;type=&amp;search=42</c> (default sort openedAt desc).</summary>
public sealed record ListOrdersQuery : PageQuery
{
    public string? Status { get; init; }
    public Guid? TableId { get; init; }
    public Guid? WaiterId { get; init; }
    public DateTime? From { get; init; }
    public DateTime? To { get; init; }
    public string? Type { get; init; }
}

public sealed class ListOrdersHandler(OrderReadService reader) : IHandler<ListOrdersQuery, PagedResult<OrderDto>>
{
    private static readonly Dictionary<string, Expression<Func<Order, object>>> SortFields = new(StringComparer.OrdinalIgnoreCase)
    {
        ["openedAt"] = o => o.OpenedAt,
        ["number"] = o => o.Number,
        ["total"] = o => o.Total,
        ["status"] = o => o.Status,
    };

    public async Task<Result<PagedResult<OrderDto>>> HandleAsync(ListOrdersQuery request, CancellationToken cancellationToken)
    {
        var query = reader.BranchOrders();
        var statuses = SnakeCaseEnum.ParseList<OrderStatus>(request.Status);
        if (statuses.Count > 0)
        {
            query = query.Where(o => statuses.Contains(o.Status));
        }

        if (SnakeCaseEnum.TryParse<OrderType>(request.Type, out var type))
        {
            query = query.Where(o => o.Type == type);
        }

        if (request.TableId is { } tableId)
        {
            query = query.Where(o => o.TableId == tableId);
        }

        if (request.WaiterId is { } waiterId)
        {
            query = query.Where(o => o.WaiterId == waiterId);
        }

        if (request.From is { } from)
        {
            var fromUtc = SnakeCaseEnum.AsUtc(from);
            query = query.Where(o => o.OpenedAt >= fromUtc);
        }

        if (request.To is { } to)
        {
            var toUtc = SnakeCaseEnum.AsUtc(to);
            query = query.Where(o => o.OpenedAt <= toUtc);
        }

        if (int.TryParse(request.Search?.Trim().TrimStart('#'), out var number))
        {
            query = query.Where(o => o.Number == number);
        }

        var page = await query
            .ApplySort(request, SortFields, o => o.OpenedAt, defaultDescending: true)
            .Select(o => o.Id)
            .ToPagedResultAsync(request, cancellationToken);
        var items = await reader.GetManyAsync(page.Items, cancellationToken);
        return new PagedResult<OrderDto>(items, page.Page, page.PageSize, page.TotalCount);
    }
}

public sealed record ListActiveOrdersQuery;

/// <summary><c>GET /orders/active</c>: all not paid/cancelled orders of the branch (plain array, oldest first).</summary>
public sealed class ListActiveOrdersHandler(OrderReadService reader) : IHandler<ListActiveOrdersQuery, IReadOnlyList<OrderDto>>
{
    public async Task<Result<IReadOnlyList<OrderDto>>> HandleAsync(ListActiveOrdersQuery request, CancellationToken cancellationToken)
    {
        var ids = await reader.BranchOrders()
            .Where(o => !OrderReadService.ClosedStatuses.Contains(o.Status))
            .OrderBy(o => o.OpenedAt)
            .Select(o => o.Id)
            .ToListAsync(cancellationToken);
        return Result.Success(await reader.GetManyAsync(ids, cancellationToken));
    }
}

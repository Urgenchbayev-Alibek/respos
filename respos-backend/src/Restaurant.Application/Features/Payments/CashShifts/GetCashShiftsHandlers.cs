using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Common.Extensions;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Common.Models;
using Restaurant.Application.Features.Payments.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Payments;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Payments.CashShifts;

public sealed record GetCurrentCashShiftQuery;

/// <summary><c>GET /cash-shifts/current</c>: the open shift of the branch, or null (→ 204).</summary>
public sealed class GetCurrentCashShiftHandler(CashShiftReadService reader) : IHandler<GetCurrentCashShiftQuery, CashShiftDto?>
{
    public async Task<Result<CashShiftDto?>> HandleAsync(GetCurrentCashShiftQuery request, CancellationToken cancellationToken)
    {
        var shift = await reader.FindOpenAsync(tracked: false, cancellationToken);
        return Result.Success(shift is null ? null : (await reader.MapAsync([shift], cancellationToken))[0]);
    }
}

public sealed record GetCashShiftQuery(Guid ShiftId);

public sealed class GetCashShiftHandler(CashShiftReadService reader) : IHandler<GetCashShiftQuery, CashShiftDto>
{
    public async Task<Result<CashShiftDto>> HandleAsync(GetCashShiftQuery request, CancellationToken cancellationToken)
    {
        var dto = await reader.GetAsync(request.ShiftId, cancellationToken);
        return dto is null ? CashShiftErrors.NotFound : dto;
    }
}

/// <summary><c>GET /cash-shifts?status=&amp;from=&amp;to=&amp;sort=</c>; sort <c>openedAt|createdAt|closedAt</c> (default openedAt desc).</summary>
public sealed record ListCashShiftsQuery : PageQuery
{
    public string? Status { get; init; }
    public DateTime? From { get; init; }
    public DateTime? To { get; init; }
}

public sealed class ListCashShiftsHandler(CashShiftReadService reader) : IHandler<ListCashShiftsQuery, PagedResult<CashShiftDto>>
{
    private static readonly Dictionary<string, Expression<Func<CashShift, object>>> SortFields = new(StringComparer.OrdinalIgnoreCase)
    {
        ["openedAt"] = s => s.OpenedAt,
        ["createdAt"] = s => s.CreatedAt,
        ["closedAt"] = s => s.ClosedAt!,
    };

    public async Task<Result<PagedResult<CashShiftDto>>> HandleAsync(ListCashShiftsQuery request, CancellationToken cancellationToken)
    {
        var query = reader.BranchShifts();
        if (SnakeCaseEnum.TryParse<CashShiftStatus>(request.Status, out var status))
        {
            query = query.Where(s => s.Status == status);
        }

        if (request.From is { } from)
        {
            var fromUtc = SnakeCaseEnum.AsUtc(from);
            query = query.Where(s => s.OpenedAt >= fromUtc);
        }

        if (request.To is { } to)
        {
            var toUtc = SnakeCaseEnum.AsUtc(to);
            query = query.Where(s => s.OpenedAt <= toUtc);
        }

        var page = await query.ApplySort(request, SortFields, s => s.OpenedAt, defaultDescending: true).ToPagedResultAsync(request, cancellationToken);
        var items = await reader.MapAsync(page.Items, cancellationToken);
        return new PagedResult<CashShiftDto>(items, page.Page, page.PageSize, page.TotalCount);
    }
}

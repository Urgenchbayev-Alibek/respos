using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Extensions;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Common.Models;
using Restaurant.Application.Features.Orders.Common;
using Restaurant.Application.Features.Payments.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Payments;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Payments.ListPayments;

/// <summary><c>GET /payments?from=&amp;to=&amp;method=&amp;orderId=&amp;shiftId=</c> &amp;sort=</c>; sort <c>createdAt|amount</c> (default createdAt:desc).</summary>
public sealed record ListPaymentsQuery : PageQuery
{
    public DateTime? From { get; init; }
    public DateTime? To { get; init; }
    public string? Method { get; init; }
    public Guid? OrderId { get; init; }
    public Guid? ShiftId { get; init; }
}

public sealed class ListPaymentsHandler(IApplicationDbContext db, ITenantContext tenant, UserNameLookup users)
    : IHandler<ListPaymentsQuery, PagedResult<PaymentDto>>
{
    private static readonly Dictionary<string, Expression<Func<Payment, object>>> SortFields = new(StringComparer.OrdinalIgnoreCase)
    {
        ["createdAt"] = p => p.CreatedAt,
        ["amount"] = p => p.Amount,
    };

    public async Task<Result<PagedResult<PaymentDto>>> HandleAsync(ListPaymentsQuery request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        var query = db.Payments.AsNoTracking().Where(p => p.BranchId == branchId);
        if (SnakeCaseEnum.TryParse<PaymentMethod>(request.Method, out var method))
        {
            query = query.Where(p => p.Method == method);
        }

        if (request.OrderId is { } orderId)
        {
            query = query.Where(p => p.OrderId == orderId);
        }

        if (request.ShiftId is { } shiftId)
        {
            query = query.Where(p => p.CashShiftId == shiftId);
        }

        if (request.From is { } from)
        {
            var fromUtc = SnakeCaseEnum.AsUtc(from);
            query = query.Where(p => p.CreatedAt >= fromUtc);
        }

        if (request.To is { } to)
        {
            var toUtc = SnakeCaseEnum.AsUtc(to);
            query = query.Where(p => p.CreatedAt <= toUtc);
        }

        var page = await query.ApplySort(request, SortFields, p => p.CreatedAt, defaultDescending: true)
            .ToPagedResultAsync(request, cancellationToken);
        var names = await users.GetAsync(page.Items.Select(p => p.CreatedBy), cancellationToken);
        var orderIds = page.Items.Select(p => p.OrderId).Distinct().ToList();
        var numbers = await db.Orders.AsNoTracking().Where(o => orderIds.Contains(o.Id))
            .ToDictionaryAsync(o => o.Id, o => o.Number, cancellationToken);
        return new PagedResult<PaymentDto>(
            page.Items.Select(p => PaymentDto.From(p, names, numbers.GetValueOrDefault(p.OrderId))).ToList(),
            page.Page, page.PageSize, page.TotalCount);
    }
}

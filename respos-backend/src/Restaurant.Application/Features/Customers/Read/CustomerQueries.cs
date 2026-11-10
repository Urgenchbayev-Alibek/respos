using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Extensions;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Common.Models;
using Restaurant.Application.Features.Customers.Common;
using Restaurant.Application.Features.Orders.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Customers;

namespace Restaurant.Application.Features.Customers.Read;

/// <summary><c>GET /customers</c>: <c>search</c> (name or phone digits), <c>segment</c> (new|regular|sleeping|birthday|vip), <c>tag</c>.</summary>
public sealed record ListCustomersQuery : PageQuery
{
    public string? Segment { get; init; }
    public string? Tag { get; init; }
}

public sealed record GetCustomerQuery(Guid Id);

public sealed record CustomerHistoryQuery : PageQuery
{
    public Guid CustomerId { get; init; }
}

public sealed class ListCustomersHandler(CustomerReadService reader) : IHandler<ListCustomersQuery, PagedResult<CustomerListItemDto>>
{
    private static readonly Dictionary<string, Expression<Func<CustomerRow, object>>> Sortable = new(StringComparer.OrdinalIgnoreCase)
    {
        ["name"] = r => r.Customer.Name,
        ["createdAt"] = r => r.Customer.CreatedAt,
        ["visits"] = r => r.Visits,
        ["totalSpent"] = r => r.TotalSpent,
        ["lastVisitAt"] = r => r.LastVisitAt!,
        ["points"] = r => r.Points,
    };

    public async Task<Result<PagedResult<CustomerListItemDto>>> HandleAsync(ListCustomersQuery request, CancellationToken cancellationToken)
    {
        var today = await reader.LocalTodayAsync(cancellationToken);
        var rows = reader.ApplySegment(reader.Rows(), request.Segment?.Trim().ToLowerInvariant(), today);
        if (!string.IsNullOrWhiteSpace(request.Tag))
        {
            var tag = request.Tag.Trim().ToLowerInvariant();
            rows = rows.Where(r => r.Customer.Tags.Contains(tag));
        }

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var term = request.Search.Trim().ToLower();
            var digits = CustomerPhone.SearchDigits(request.Search);
            rows = digits.Length >= 3
                ? rows.Where(r => r.Customer.Phone.Contains(digits) || r.Customer.Name.ToLower().Contains(term))
                : rows.Where(r => r.Customer.Name.ToLower().Contains(term));
        }

        var page = await rows.ApplySort(request, Sortable, r => r.Customer.CreatedAt, defaultDescending: true)
            .ToPagedResultAsync(request, cancellationToken);
        return new PagedResult<CustomerListItemDto>(
            page.Items.Select(r => CustomerReadService.ToListItem(r, today)).ToList(), page.Page, page.PageSize, page.TotalCount);
    }
}

public sealed class GetCustomerHandler(CustomerReadService reader) : IHandler<GetCustomerQuery, CustomerDto>
{
    public async Task<Result<CustomerDto>> HandleAsync(GetCustomerQuery request, CancellationToken cancellationToken)
    {
        var dto = await reader.GetAsync(request.Id, cancellationToken);
        return dto is null ? CustomerErrors.NotFound : dto;
    }
}

/// <summary><c>GET /customers/{id}/orders</c>: the guest's orders in every branch of the org, newest first.</summary>
public sealed class CustomerOrdersHandler(IApplicationDbContext db) : IHandler<CustomerHistoryQuery, PagedResult<CustomerOrderDto>>
{
    public async Task<Result<PagedResult<CustomerOrderDto>>> HandleAsync(CustomerHistoryQuery request, CancellationToken cancellationToken)
    {
        if (!await db.Customers.AnyAsync(c => c.Id == request.CustomerId, cancellationToken))
        {
            return CustomerErrors.NotFound;
        }

        var page = await db.Orders.AsNoTracking()
            .Where(o => o.CustomerId == request.CustomerId)
            .OrderByDescending(o => o.OpenedAt)
            .Select(o => new CustomerOrderDto(
                o.Id, o.Number, o.BranchId,
                db.Branches.Where(b => b.Id == o.BranchId).Select(b => b.Name).FirstOrDefault(),
                o.BusinessDate, o.Type, o.Status, o.Total, o.PaidAmount, o.LoyaltyDiscountAmount, o.OpenedAt, o.ClosedAt))
            .ToPagedResultAsync(request, cancellationToken);
        return page;
    }
}

/// <summary><c>GET /customers/{id}/loyalty/transactions</c>: points ledger, newest first.</summary>
public sealed class CustomerLedgerHandler(IApplicationDbContext db, UserNameLookup users)
    : IHandler<CustomerHistoryQuery, PagedResult<LoyaltyTransactionDto>>
{
    public async Task<Result<PagedResult<LoyaltyTransactionDto>>> HandleAsync(CustomerHistoryQuery request, CancellationToken cancellationToken)
    {
        if (!await db.Customers.AnyAsync(c => c.Id == request.CustomerId, cancellationToken))
        {
            return CustomerErrors.NotFound;
        }

        var page = await db.LoyaltyTransactions.AsNoTracking()
            .Where(t => t.CustomerId == request.CustomerId)
            .OrderByDescending(t => t.CreatedAt).ThenBy(t => t.Points)
            .Select(t => new
            {
                Entry = t,
                OrderNumber = db.Orders.Where(o => o.Id == t.OrderId).Select(o => (int?)o.Number).FirstOrDefault(),
            })
            .ToPagedResultAsync(request, cancellationToken);
        var names = await users.GetAsync(page.Items.Select(i => i.Entry.CreatedBy), cancellationToken);
        var items = page.Items.Select(i => new LoyaltyTransactionDto(
            i.Entry.Id, i.Entry.Type, i.Entry.Reason, i.Entry.Points, i.Entry.BalanceAfter, i.Entry.OrderId, i.OrderNumber,
            i.Entry.ExpiresAt, i.Entry.CreatedAt, i.Entry.CreatedBy is { } by ? names.GetValueOrDefault(by) : null)).ToList();
        return new PagedResult<LoyaltyTransactionDto>(items, page.Page, page.PageSize, page.TotalCount);
    }
}

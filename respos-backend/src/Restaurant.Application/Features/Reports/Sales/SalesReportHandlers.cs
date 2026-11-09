using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Reports.Common;
using Restaurant.Domain.Common;

namespace Restaurant.Application.Features.Reports.Sales;

/// <summary><c>GET /reports/sales?from=&amp;to=</c> — revenue (paid orders − refunds), orders, average check, by day.</summary>
public sealed class SalesReportHandler(IApplicationDbContext db, ReportScope scope) : IHandler<ReportPeriodQuery, SalesReportDto>
{
    public async Task<Result<SalesReportDto>> HandleAsync(ReportPeriodQuery request, CancellationToken cancellationToken)
    {
        var ctx = await scope.ResolveAsync(request, cancellationToken);
        var byDay = await db.SalesByDayAsync(ctx.BranchId, ctx.From, ctx.To, cancellationToken);
        var revenue = byDay.Sum(d => d.Revenue);
        var orders = byDay.Sum(d => d.Orders);
        return new SalesReportDto(revenue, orders, ReportMath.AverageCheck(revenue, orders), byDay);
    }
}

public sealed record TopItemsQuery : ReportPeriodQuery
{
    public const int DefaultLimit = 10;
    public const int MaxLimit = 100;

    public int? Limit { get; init; }

    public int SafeLimit => Limit is > 0 and <= MaxLimit ? Limit.Value : DefaultLimit;
}

public sealed class TopItemsQueryValidator : AbstractValidator<TopItemsQuery>
{
    public TopItemsQueryValidator()
    {
        ReportPeriodRules.Apply(this);
        RuleFor(x => x.Limit).InclusiveBetween(1, TopItemsQuery.MaxLimit).When(x => x.Limit is not null);
    }
}

/// <summary><c>GET /reports/top-items?from=&amp;to=&amp;limit=</c> — by quantity sold (paid orders, non-cancelled items).</summary>
public sealed class TopItemsReportHandler(IApplicationDbContext db, ReportScope scope) : IHandler<TopItemsQuery, IReadOnlyList<TopItemDto>>
{
    public async Task<Result<IReadOnlyList<TopItemDto>>> HandleAsync(TopItemsQuery request, CancellationToken cancellationToken)
    {
        var ctx = await scope.ResolveAsync(request, cancellationToken);
        return Result.Success(await db.TopItemsAsync(ctx.BranchId, ctx.From, ctx.To, request.SafeLimit, cancellationToken));
    }
}

/// <summary><c>GET /reports/sales-by-category?from=&amp;to=</c> — item revenue (line totals) and quantity per menu category.</summary>
public sealed class SalesByCategoryReportHandler(IApplicationDbContext db, ReportScope scope)
    : IHandler<ReportPeriodQuery, IReadOnlyList<CategorySalesDto>>
{
    public async Task<Result<IReadOnlyList<CategorySalesDto>>> HandleAsync(ReportPeriodQuery request, CancellationToken cancellationToken)
    {
        var ctx = await scope.ResolveAsync(request, cancellationToken);
        var rows = await (
                from item in db.PaidOrders(ctx.BranchId, ctx.From, ctx.To).SoldItems()
                join menuItem in db.MenuItems on item.MenuItemId equals menuItem.Id
                group item by menuItem.CategoryId into g
                select new { CategoryId = g.Key, Revenue = g.Sum(i => i.LineTotal), Quantity = g.Sum(i => i.Quantity) })
            .ToListAsync(cancellationToken);

        var categoryIds = rows.Select(r => r.CategoryId).ToList();
        var names = await db.MenuCategories.Where(c => categoryIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, c => c.Name, cancellationToken);
        IReadOnlyList<CategorySalesDto> result = rows
            .Select(r => new CategorySalesDto(r.CategoryId, names.GetValueOrDefault(r.CategoryId, string.Empty), r.Revenue, r.Quantity))
            .OrderByDescending(r => r.Revenue)
            .ToList();
        return Result.Success(result);
    }
}

/// <summary>
/// <c>GET /reports/payment-methods?from=&amp;to=</c> — payments and refunds registered in the period
/// (UTC interval of the branch-local days), net amount per method.
/// </summary>
public sealed class PaymentMethodsReportHandler(IApplicationDbContext db, ReportScope scope)
    : IHandler<ReportPeriodQuery, IReadOnlyList<PaymentMethodTotalDto>>
{
    public async Task<Result<IReadOnlyList<PaymentMethodTotalDto>>> HandleAsync(ReportPeriodQuery request, CancellationToken cancellationToken)
    {
        var ctx = await scope.ResolveAsync(request, cancellationToken);
        var payments = await db.Payments
            .Where(p => p.BranchId == ctx.BranchId && p.CreatedAt >= ctx.Utc.FromUtc && p.CreatedAt < ctx.Utc.ToUtc)
            .GroupBy(p => p.Method)
            .Select(g => new { Method = g.Key, Amount = g.Sum(p => p.Amount), Count = g.Count() })
            .ToListAsync(cancellationToken);
        var refunds = await db.Refunds
            .Where(r => r.BranchId == ctx.BranchId && r.CreatedAt >= ctx.Utc.FromUtc && r.CreatedAt < ctx.Utc.ToUtc)
            .GroupBy(r => r.Method)
            .Select(g => new { Method = g.Key, Amount = g.Sum(r => r.Amount) })
            .ToDictionaryAsync(r => r.Method, r => r.Amount, cancellationToken);

        IReadOnlyList<PaymentMethodTotalDto> result = payments.Select(p => p.Method).Union(refunds.Keys)
            .Order()
            .Select(method =>
            {
                var paid = payments.FirstOrDefault(p => p.Method == method);
                var refunded = refunds.GetValueOrDefault(method);
                return new PaymentMethodTotalDto(method, (paid?.Amount ?? 0m) - refunded, paid?.Count ?? 0, refunded);
            })
            .ToList();
        return Result.Success(result);
    }
}

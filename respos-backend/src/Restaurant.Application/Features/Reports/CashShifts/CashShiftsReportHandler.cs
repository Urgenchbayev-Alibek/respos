using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Reports.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Reports.CashShifts;

/// <summary><c>GET /reports/cash-shifts?from=&amp;to=</c> — shifts opened in the period with payment/refund totals (SQL sub-queries).</summary>
public sealed class CashShiftsReportHandler(IApplicationDbContext db, ReportScope scope)
    : IHandler<ReportPeriodQuery, IReadOnlyList<CashShiftReportDto>>
{
    public async Task<Result<IReadOnlyList<CashShiftReportDto>>> HandleAsync(ReportPeriodQuery request, CancellationToken cancellationToken)
    {
        var ctx = await scope.ResolveAsync(request, cancellationToken);
        var rows = await db.CashShifts
            .Where(s => s.BranchId == ctx.BranchId && s.OpenedAt >= ctx.Utc.FromUtc && s.OpenedAt < ctx.Utc.ToUtc)
            .OrderBy(s => s.OpenedAt)
            .Select(s => new
            {
                s.Id,
                s.OpenedAt,
                OpenedByName = db.Users.Where(u => u.Id == s.OpenedBy).Select(u => u.FullName).FirstOrDefault(),
                s.ClosedAt,
                ClosedByName = db.Users.Where(u => u.Id == s.ClosedBy).Select(u => u.FullName).FirstOrDefault(),
                s.Status,
                s.OpeningAmount,
                Cash = db.Payments.Where(p => p.CashShiftId == s.Id && p.Method == PaymentMethod.Cash).Sum(p => (decimal?)p.Amount) ?? 0m,
                Card = db.Payments.Where(p => p.CashShiftId == s.Id && p.Method == PaymentMethod.Card).Sum(p => (decimal?)p.Amount) ?? 0m,
                Other = db.Payments.Where(p => p.CashShiftId == s.Id && p.Method == PaymentMethod.Other).Sum(p => (decimal?)p.Amount) ?? 0m,
                Refunds = db.Refunds.Where(r => r.CashShiftId == s.Id).Sum(r => (decimal?)r.Amount) ?? 0m,
                s.ExpectedCashAmount,
                s.ActualCashAmount,
                s.Difference,
            })
            .ToListAsync(cancellationToken);

        IReadOnlyList<CashShiftReportDto> result = rows
            .Select(r => new CashShiftReportDto(
                r.Id, r.OpenedAt, r.OpenedByName, r.ClosedAt, r.ClosedByName, r.Status, r.OpeningAmount,
                r.Cash, r.Card, r.Other, r.Refunds, r.ExpectedCashAmount, r.ActualCashAmount, r.Difference))
            .ToList();
        return Result.Success(result);
    }
}

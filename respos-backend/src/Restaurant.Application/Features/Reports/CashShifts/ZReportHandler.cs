using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Reports.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Payments;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Reports.CashShifts;

/// <summary><c>GET /reports/z-report?shiftId=</c>.</summary>
public sealed record ZReportQuery
{
    public Guid? ShiftId { get; init; }
}

public sealed class ZReportQueryValidator : AbstractValidator<ZReportQuery>
{
    public ZReportQueryValidator() => RuleFor(x => x.ShiftId).NotEmpty();
}

public sealed record ZReportMethodDto(PaymentMethod Method, int PaymentsCount, decimal Payments, int RefundsCount, decimal Refunds, decimal Net);

/// <summary>
/// Z-report of one cash shift of the current branch: totals per payment method (payments and refunds registered in
/// the shift), orders paid, expected/actual cash and difference. <c>tipsAmount</c> is 0 until payments carry tips (F2).
/// </summary>
public sealed record ZReportDto(
    Guid ShiftId,
    string BranchName,
    string Timezone,
    CashShiftStatus Status,
    DateTime OpenedAt,
    string? OpenedByName,
    DateTime? ClosedAt,
    string? ClosedByName,
    decimal OpeningAmount,
    IReadOnlyList<ZReportMethodDto> Methods,
    decimal TotalPayments,
    decimal TotalRefunds,
    decimal NetAmount,
    int OrdersCount,
    decimal TipsAmount,
    decimal? ExpectedCashAmount,
    decimal? ActualCashAmount,
    decimal? Difference);

public sealed class ZReportHandler(IApplicationDbContext db, ITenantContext tenant) : IHandler<ZReportQuery, ZReportDto>
{
    public async Task<Result<ZReportDto>> HandleAsync(ZReportQuery request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        var shift = await db.CashShifts.AsNoTracking()
            .Where(s => s.Id == request.ShiftId && s.BranchId == branchId)
            .Select(s => new
            {
                s.Id, s.Status, s.OpenedAt, s.ClosedAt, s.OpeningAmount, s.ExpectedCashAmount, s.ActualCashAmount, s.Difference,
                OpenedByName = db.Users.Where(u => u.Id == s.OpenedBy).Select(u => u.FullName).FirstOrDefault(),
                ClosedByName = db.Users.Where(u => u.Id == s.ClosedBy).Select(u => u.FullName).FirstOrDefault(),
            })
            .FirstOrDefaultAsync(cancellationToken);
        if (shift is null)
        {
            return CashShiftErrors.NotFound;
        }

        var branch = await db.Branches.Where(b => b.Id == branchId).Select(b => new { b.Name, b.Timezone }).FirstAsync(cancellationToken);
        var payments = await db.Payments.Where(p => p.CashShiftId == shift.Id)
            .GroupBy(p => p.Method)
            .Select(g => new { Method = g.Key, Count = g.Count(), Amount = g.Sum(p => p.Amount) })
            .ToListAsync(cancellationToken);
        var refunds = await db.Refunds.Where(r => r.CashShiftId == shift.Id)
            .GroupBy(r => r.Method)
            .Select(g => new { Method = g.Key, Count = g.Count(), Amount = g.Sum(r => r.Amount) })
            .ToListAsync(cancellationToken);
        var orders = await db.Payments.Where(p => p.CashShiftId == shift.Id).Select(p => p.OrderId).Distinct().CountAsync(cancellationToken);
        var tips = await db.Payments.Where(p => p.CashShiftId == shift.Id).SumAsync(p => p.TipAmount, cancellationToken);

        var methods = payments.Select(p => p.Method).Union(refunds.Select(r => r.Method)).Order()
            .Select(method =>
            {
                var paid = payments.FirstOrDefault(p => p.Method == method);
                var refunded = refunds.FirstOrDefault(r => r.Method == method);
                var paidAmount = paid?.Amount ?? 0m;
                var refundAmount = refunded?.Amount ?? 0m;
                return new ZReportMethodDto(method, paid?.Count ?? 0, paidAmount, refunded?.Count ?? 0, refundAmount, paidAmount - refundAmount);
            })
            .ToList();
        var totalPayments = methods.Sum(m => m.Payments);
        var totalRefunds = methods.Sum(m => m.Refunds);

        return new ZReportDto(
            shift.Id, branch.Name, BranchTime.Resolve(branch.Timezone).Id, shift.Status, shift.OpenedAt, shift.OpenedByName,
            shift.ClosedAt, shift.ClosedByName, shift.OpeningAmount, methods, totalPayments, totalRefunds, totalPayments - totalRefunds,
            orders, TipsAmount: tips, shift.ExpectedCashAmount, shift.ActualCashAmount, shift.Difference);
    }
}

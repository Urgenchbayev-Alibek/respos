using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Orders.Common;
using Restaurant.Domain.Entities.Payments;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Payments.Common;

public sealed record CashShiftTotals(decimal CashPayments, decimal CashRefunds, IReadOnlyList<CashShiftMethodTotalDto> ByMethod)
{
    public static readonly CashShiftTotals Empty = new(0m, 0m, []);

    public decimal Tips { get; init; }
    public decimal CashTips { get; init; }

    /// <summary>Cash that should be in the drawer besides the opening amount (cash tips included).</summary>
    public decimal CashIn => CashPayments + CashTips;
}

/// <summary>Shift totals (payments − refunds per method, cash in/out) and DTO mapping for the current branch.</summary>
[ScopedService]
public sealed class CashShiftReadService(IApplicationDbContext db, ITenantContext tenant, UserNameLookup users)
{
    public IQueryable<CashShift> BranchShifts()
    {
        var branchId = tenant.RequireBranchId();
        return db.CashShifts.AsNoTracking().Where(s => s.BranchId == branchId);
    }

    public Task<CashShift?> FindOpenAsync(bool tracked, CancellationToken ct)
    {
        var branchId = tenant.RequireBranchId();
        var query = tracked ? db.CashShifts : db.CashShifts.AsNoTracking();
        return query.FirstOrDefaultAsync(s => s.BranchId == branchId && s.Status == CashShiftStatus.Open, ct);
    }

    public async Task<IReadOnlyDictionary<Guid, CashShiftTotals>> TotalsAsync(IReadOnlyCollection<Guid> shiftIds, CancellationToken ct)
    {
        var payments = await db.Payments.AsNoTracking()
            .Where(p => shiftIds.Contains(p.CashShiftId))
            .GroupBy(p => new { p.CashShiftId, p.Method })
            .Select(g => new { g.Key.CashShiftId, g.Key.Method, Amount = g.Sum(p => p.Amount), Tips = g.Sum(p => p.TipAmount) })
            .ToListAsync(ct);
        var refunds = await db.Refunds.AsNoTracking()
            .Where(r => shiftIds.Contains(r.CashShiftId))
            .GroupBy(r => new { r.CashShiftId, r.Method })
            .Select(g => new { g.Key.CashShiftId, g.Key.Method, Amount = g.Sum(r => r.Amount) })
            .ToListAsync(ct);

        return shiftIds.ToDictionary(id => id, id =>
        {
            decimal Paid(PaymentMethod m) => payments.Where(p => p.CashShiftId == id && p.Method == m).Sum(p => p.Amount);
            decimal Refunded(PaymentMethod m) => refunds.Where(r => r.CashShiftId == id && r.Method == m).Sum(r => r.Amount);
            var byMethod = Enum.GetValues<PaymentMethod>()
                .Select(m => new CashShiftMethodTotalDto(m, Paid(m) - Refunded(m)))
                .ToList();
            return new CashShiftTotals(Paid(PaymentMethod.Cash), Refunded(PaymentMethod.Cash), byMethod)
            {
                Tips = payments.Where(p => p.CashShiftId == id).Sum(p => p.Tips),
                CashTips = payments.Where(p => p.CashShiftId == id && p.Method == PaymentMethod.Cash).Sum(p => p.Tips),
            };
        });
    }

    public async Task<decimal> ExpectedCashAsync(CashShift shift, CancellationToken ct)
    {
        var totals = (await TotalsAsync([shift.Id], ct))[shift.Id];
        return CashShift.CalculateExpectedCash(shift.OpeningAmount, totals.CashIn, totals.CashRefunds);
    }

    public async Task<CashShiftDto?> GetAsync(Guid shiftId, CancellationToken ct)
    {
        var shift = await BranchShifts().FirstOrDefaultAsync(s => s.Id == shiftId, ct);
        return shift is null ? null : (await MapAsync([shift], ct))[0];
    }

    public async Task<IReadOnlyList<CashShiftDto>> MapAsync(IReadOnlyList<CashShift> shifts, CancellationToken ct)
    {
        var totals = await TotalsAsync(shifts.Select(s => s.Id).ToList(), ct);
        var names = await users.GetAsync(shifts.Select(s => (Guid?)s.OpenedBy).Concat(shifts.Select(s => s.ClosedBy)), ct);
        return shifts.Select(s =>
        {
            var t = totals.GetValueOrDefault(s.Id) ?? CashShiftTotals.Empty;
            var expected = s.Status == CashShiftStatus.Open
                ? CashShift.CalculateExpectedCash(s.OpeningAmount, t.CashIn, t.CashRefunds)
                : s.ExpectedCashAmount;
            return new CashShiftDto(
                s.Id, s.Status, s.OpenedBy, names.GetValueOrDefault(s.OpenedBy), s.OpenedAt, s.OpeningAmount,
                s.ClosedBy, s.ClosedBy is { } by ? names.GetValueOrDefault(by) : null, s.ClosedAt,
                expected, s.ActualCashAmount, s.Difference, s.Comment, t.CashPayments, t.CashRefunds, t.ByMethod)
            {
                TipsAmount = t.Tips,
                CashTipsAmount = t.CashTips,
            };
        }).ToList();
    }
}

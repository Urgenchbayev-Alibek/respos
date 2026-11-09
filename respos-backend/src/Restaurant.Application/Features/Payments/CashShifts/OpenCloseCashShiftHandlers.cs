using System.Text.Json.Serialization;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Payments.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Payments;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Payments.CashShifts;

public sealed record OpenCashShiftCommand(decimal OpeningAmount);

public sealed class OpenCashShiftValidator : AbstractValidator<OpenCashShiftCommand>
{
    public OpenCashShiftValidator() => RuleFor(x => x.OpeningAmount).GreaterThanOrEqualTo(0m).PrecisionScale(18, 2, true);
}

/// <summary><c>POST /cash-shifts/open</c>: one open shift per branch (409 <c>cash_shift.already_open</c>; DB filtered unique index as safety net).</summary>
public sealed class OpenCashShiftHandler(
    IApplicationDbContext db, ITenantContext tenant, IClock clock, IAuditLogger audit, CashShiftReadService reader)
    : IHandler<OpenCashShiftCommand, CashShiftDto>
{
    public async Task<Result<CashShiftDto>> HandleAsync(OpenCashShiftCommand request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        if (await reader.FindOpenAsync(tracked: false, cancellationToken) is not null)
        {
            return CashShiftErrors.AlreadyOpen;
        }

        var shift = CashShift.Open(branchId, tenant.RequireUserId(), request.OpeningAmount, clock.UtcNow);
        db.CashShifts.Add(shift);
        audit.Log("cash_shift.opened", nameof(CashShift), shift.Id, new { shift.OpeningAmount });
        await db.SaveChangesAsync(cancellationToken);
        return (await reader.GetAsync(shift.Id, cancellationToken))!;
    }
}

public sealed record CloseCashShiftCommand(decimal ActualCashAmount, string? Comment)
{
    [JsonIgnore]
    public Guid ShiftId { get; init; }
}

public sealed class CloseCashShiftValidator : AbstractValidator<CloseCashShiftCommand>
{
    public CloseCashShiftValidator()
    {
        RuleFor(x => x.ActualCashAmount).GreaterThanOrEqualTo(0m).PrecisionScale(18, 2, true);
        RuleFor(x => x.Comment).MaximumLength(1000);
    }
}

/// <summary>
/// <c>POST /cash-shifts/{id}/close</c>: expected = opening + cash payments − cash refunds of this shift;
/// difference = actual − expected; audited.
/// </summary>
public sealed class CloseCashShiftHandler(
    IApplicationDbContext db, ITenantContext tenant, IClock clock, IAuditLogger audit, CashShiftReadService reader)
    : IHandler<CloseCashShiftCommand, CashShiftDto>
{
    public async Task<Result<CashShiftDto>> HandleAsync(CloseCashShiftCommand request, CancellationToken cancellationToken)
    {
        var branchId = tenant.RequireBranchId();
        var shift = await db.CashShifts.FirstOrDefaultAsync(s => s.Id == request.ShiftId && s.BranchId == branchId, cancellationToken);
        if (shift is null)
        {
            return CashShiftErrors.NotFound;
        }

        if (shift.Status != CashShiftStatus.Open)
        {
            return CashShiftErrors.Closed;
        }

        var expected = await reader.ExpectedCashAsync(shift, cancellationToken);
        var comment = string.IsNullOrWhiteSpace(request.Comment) ? null : request.Comment.Trim();
        shift.Close(expected, request.ActualCashAmount, tenant.RequireUserId(), comment, clock.UtcNow);
        audit.Log("cash_shift.closed", nameof(CashShift), shift.Id, new
        {
            shift.OpeningAmount, shift.ExpectedCashAmount, shift.ActualCashAmount, shift.Difference, comment,
        });
        await db.SaveChangesAsync(cancellationToken);
        return (await reader.GetAsync(shift.Id, cancellationToken))!;
    }
}

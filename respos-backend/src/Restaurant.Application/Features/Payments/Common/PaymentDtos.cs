using Restaurant.Domain.Entities.Payments;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Payments.Common;

public sealed record PaymentDto(
    Guid Id,
    Guid OrderId,
    Guid CashShiftId,
    PaymentMethod Method,
    decimal Amount,
    decimal RefundedAmount,
    PaymentStatus Status,
    string Provider,
    string? ExternalReference,
    DateTime CreatedAt,
    Guid? CreatedBy,
    string? CreatedByName,
    int OrderNumber)
{
    /// <summary>F2: bill of a split order (null = whole order).</summary>
    public Guid? BillId { get; init; }

    /// <summary>F2: tip on top of <see cref="Amount"/> (not revenue).</summary>
    public decimal TipAmount { get; init; }

    public static PaymentDto From(Payment p, IReadOnlyDictionary<Guid, string> names, int orderNumber) => new(
        p.Id, p.OrderId, p.CashShiftId, p.Method, p.Amount, p.RefundedAmount, p.Status, p.Provider, p.ExternalReference,
        p.CreatedAt, p.CreatedBy, p.CreatedBy is { } by ? names.GetValueOrDefault(by) : null, orderNumber)
    {
        BillId = p.BillId,
        TipAmount = p.TipAmount,
    };
}

public sealed record RefundDto(
    Guid Id,
    Guid PaymentId,
    Guid OrderId,
    Guid CashShiftId,
    PaymentMethod Method,
    decimal Amount,
    string Reason,
    DateTime CreatedAt,
    string? CreatedByName,
    PaymentDto Payment);

public sealed record CashShiftMethodTotalDto(PaymentMethod Method, decimal Amount);

/// <summary>
/// Cash shift. For an open shift <see cref="ExpectedCashAmount"/> is the live expected cash;
/// <see cref="TotalsByMethod"/> = Σ payments − Σ refunds of this shift per method (tips excluded).
/// Expected cash = opening + cash payments + cash tips − cash refunds.
/// </summary>
public sealed record CashShiftDto(
    Guid Id,
    CashShiftStatus Status,
    Guid OpenedBy,
    string? OpenedByName,
    DateTime OpenedAt,
    decimal OpeningAmount,
    Guid? ClosedBy,
    string? ClosedByName,
    DateTime? ClosedAt,
    decimal? ExpectedCashAmount,
    decimal? ActualCashAmount,
    decimal? Difference,
    string? Comment,
    decimal CashPaymentsAmount,
    decimal CashRefundsAmount,
    IReadOnlyList<CashShiftMethodTotalDto> TotalsByMethod)
{
    /// <summary>F2: Σ tips of the shift (all methods) — separate line, not revenue.</summary>
    public decimal TipsAmount { get; init; }

    /// <summary>F2: cash tips — included in the expected cash (they are in the drawer).</summary>
    public decimal CashTipsAmount { get; init; }
}

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
    public static PaymentDto From(Payment p, IReadOnlyDictionary<Guid, string> names, int orderNumber) => new(
        p.Id, p.OrderId, p.CashShiftId, p.Method, p.Amount, p.RefundedAmount, p.Status, p.Provider, p.ExternalReference,
        p.CreatedAt, p.CreatedBy, p.CreatedBy is { } by ? names.GetValueOrDefault(by) : null, orderNumber);
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
/// <see cref="TotalsByMethod"/> = Σ payments − Σ refunds of this shift per method.
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
    IReadOnlyList<CashShiftMethodTotalDto> TotalsByMethod);

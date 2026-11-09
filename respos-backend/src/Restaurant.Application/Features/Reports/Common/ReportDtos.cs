using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Reports.Common;

public sealed record SalesDayDto(DateOnly Date, decimal Revenue, int Orders);

public sealed record SalesReportDto(decimal TotalRevenue, int OrdersCount, decimal AverageCheck, IReadOnlyList<SalesDayDto> ByDay);

public sealed record TopItemDto(Guid MenuItemId, string Name, decimal Quantity, decimal Revenue);

public sealed record CategorySalesDto(Guid CategoryId, string Name, decimal Revenue, decimal Quantity);

/// <summary><c>amount</c> = payments − refunds of this method in the period; <c>count</c> = number of payments.</summary>
public sealed record PaymentMethodTotalDto(PaymentMethod Method, decimal Amount, int Count, decimal RefundedAmount);

public sealed record StockBalanceReportDto(
    Guid IngredientId, string Name, string? Sku, string UnitCode, decimal Quantity, decimal MinQuantity, bool IsLow,
    decimal CostPrice, decimal StockValue);

public sealed record StockMovementTotalDto(
    StockMovementType Type, Guid IngredientId, string IngredientName, string UnitCode, decimal Quantity, int Count);

public sealed record CashShiftReportDto(
    Guid Id,
    DateTime OpenedAt,
    string? OpenedByName,
    DateTime? ClosedAt,
    string? ClosedByName,
    CashShiftStatus Status,
    decimal OpeningAmount,
    decimal CashPayments,
    decimal CardPayments,
    decimal OtherPayments,
    decimal Refunds,
    decimal? ExpectedCashAmount,
    decimal? ActualCashAmount,
    decimal? Difference);

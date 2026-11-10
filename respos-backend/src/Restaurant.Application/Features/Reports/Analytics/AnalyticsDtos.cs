using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Reports.Analytics;

/// <summary>ABC metric: what the items are ranked by.</summary>
public enum AbcMetric
{
    Revenue,
    Quantity,
    Margin,
}

public sealed record AbcItemDto(
    Guid MenuItemId,
    string Name,
    decimal Quantity,
    decimal Revenue,
    decimal Cost,
    decimal Margin,
    decimal Value,
    decimal SharePercent,
    decimal CumulativePercent,
    string Class);

/// <summary>Classes: A while the cumulative share before the item is &lt; 80 %, B while &lt; 95 %, otherwise C.</summary>
public sealed record AbcReportDto(AbcMetric Metric, decimal Total, IReadOnlyList<AbcItemDto> Items);

public sealed record FoodCostItemDto(
    Guid MenuItemId,
    Guid? VariantId,
    string Name,
    string? VariantName,
    string CategoryName,
    decimal Price,
    bool HasRecipe,
    bool HasMissingConversions,
    decimal RecipeCost,
    decimal? FoodCostPercent,
    decimal MarginAmount,
    decimal? MarginPercent,
    bool IsAboveThreshold);

public sealed record FoodCostReportDto(decimal ThresholdPercent, int AboveThresholdCount, IReadOnlyList<FoodCostItemDto> Items);

/// <summary>
/// <c>tipsAmount</c> is always 0 until payments carry tips (F2 <c>Payment.TipAmount</c>); the field is part of the
/// contract so the UI and exports do not change when tips are added.
/// </summary>
public sealed record WaiterPerformanceDto(
    Guid WaiterId,
    string Name,
    int OrdersCount,
    decimal Revenue,
    decimal AverageCheck,
    decimal ItemsSold,
    int CancelledOrders,
    int CancelledItems,
    decimal DiscountsAmount,
    decimal TipsAmount);

/// <summary><c>weekday</c> is ISO (1 = Monday … 7 = Sunday), <c>hour</c> 0–23, both in the branch timezone.</summary>
public sealed record HeatmapCellDto(int Weekday, int Hour, int Orders, decimal Revenue);

public sealed record HeatmapReportDto(decimal MaxRevenue, int MaxOrders, IReadOnlyList<HeatmapCellDto> Cells);

public sealed record DiscountedOrderDto(
    Guid OrderId, int Number, DateOnly BusinessDate, string? WaiterName, DiscountType DiscountType, decimal DiscountValue,
    decimal Subtotal, decimal DiscountAmount, decimal Total);

public sealed record StaffAmountDto(Guid WaiterId, string Name, int Count, decimal Amount);

public sealed record CancelReasonDto(string Reason, int OrdersCount, int ItemsCount, decimal Amount);

public sealed record DiscountsSummaryDto(
    int OrdersCount, decimal Amount, IReadOnlyList<StaffAmountDto> ByWaiter, IReadOnlyList<DiscountedOrderDto> Orders);

public sealed record CancellationsSummaryDto(
    int OrdersCount, decimal OrdersAmount, int ItemsCount, decimal ItemsAmount,
    IReadOnlyList<CancelReasonDto> ByReason, IReadOnlyList<StaffAmountDto> ByWaiter);

public sealed record DiscountsCancellationsDto(DiscountsSummaryDto Discounts, CancellationsSummaryDto Cancellations);

public sealed record SalesTotalsDto(
    decimal Revenue, decimal GrossRevenue, decimal Refunds, int OrdersCount, decimal AverageCheck, decimal ItemsSold,
    decimal DiscountsAmount, int GuestsCount);

/// <summary>Δ % vs the previous period of equal length; <c>null</c> when the previous value is 0.</summary>
public sealed record SalesDeltasDto(
    decimal? Revenue, decimal? OrdersCount, decimal? AverageCheck, decimal? ItemsSold, decimal? DiscountsAmount, decimal? GuestsCount);

public sealed record SalesSummaryDto(
    DateOnly From,
    DateOnly To,
    DateOnly PreviousFrom,
    DateOnly PreviousTo,
    SalesTotalsDto Current,
    SalesTotalsDto Previous,
    SalesDeltasDto Deltas,
    IReadOnlyList<Common.SalesDayDto> ByDay,
    IReadOnlyList<Common.SalesDayDto> PreviousByDay);

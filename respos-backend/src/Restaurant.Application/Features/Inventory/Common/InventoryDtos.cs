using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Inventory.Common;

public sealed record UnitDto(Guid Id, string Code, string Name, UnitKind Kind);

public sealed record UnitConversionDto(Guid Id, Guid FromUnitId, string FromUnitCode, Guid ToUnitId, string ToUnitCode, decimal Factor);

public sealed record IngredientCategoryDto(Guid Id, string Name, bool IsArchived);

public sealed record IngredientDto(
    Guid Id,
    string Name,
    string? Sku,
    Guid? CategoryId,
    string? CategoryName,
    Guid BaseUnitId,
    string BaseUnitCode,
    decimal CostPrice,
    decimal Quantity,
    decimal MinQuantity,
    bool IsLow,
    bool IsArchived);

public sealed record StockMovementDto(
    Guid Id,
    Guid IngredientId,
    string IngredientName,
    string BaseUnitCode,
    StockMovementType Type,
    decimal Quantity,
    decimal BalanceAfter,
    decimal? UnitCost,
    StockMovementSource SourceType,
    Guid? SourceId,
    string? Reason,
    Guid? CreatedBy,
    string? CreatedByName,
    DateTime CreatedAt);

public sealed record InventoryCountLineDto(
    Guid IngredientId,
    string IngredientName,
    string BaseUnitCode,
    decimal ExpectedQty,
    decimal? CountedQty,
    decimal? Difference);

public sealed record InventoryCountDto(
    Guid Id,
    InventoryCountStatus Status,
    string? Comment,
    DateTime CreatedAt,
    DateTime? CompletedAt,
    IReadOnlyList<InventoryCountLineDto> Lines);

public sealed record InventoryCountSummaryDto(
    Guid Id,
    InventoryCountStatus Status,
    string? Comment,
    DateTime CreatedAt,
    DateTime? CompletedAt,
    int LineCount);

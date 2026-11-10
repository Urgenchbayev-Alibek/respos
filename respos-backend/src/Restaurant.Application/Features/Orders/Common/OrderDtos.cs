using Restaurant.Application.Features.Customers.Common;
using Restaurant.Application.Features.Payments.Common;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Orders.Common;

public sealed record OrderItemModifierDto(string Name, decimal PriceDelta);

public sealed record OrderItemDto(
    Guid Id,
    Guid MenuItemId,
    Guid? VariantId,
    string Name,
    string? VariantName,
    decimal UnitPrice,
    decimal Quantity,
    IReadOnlyList<OrderItemModifierDto> Modifiers,
    string? Comment,
    OrderItemStatus Status,
    decimal LineTotal,
    Guid? StationId,
    DateTime? SentAt,
    DateTime? ReadyAt,
    string? CancelReason);

public sealed record OrderHistoryDto(OrderStatus? FromStatus, OrderStatus ToStatus, string? ChangedByName, DateTime ChangedAt, string? Reason);

/// <summary>Order with server-calculated money fields (CONVENTIONS.md "Money calculation").</summary>
public sealed record OrderDto(
    Guid Id,
    int Number,
    DateOnly BusinessDate,
    OrderType Type,
    OrderStatus Status,
    Guid? TableId,
    string? TableNumber,
    Guid WaiterId,
    string? WaiterName,
    int GuestCount,
    IReadOnlyList<OrderItemDto> Items,
    decimal Subtotal,
    DiscountType DiscountType,
    decimal DiscountValue,
    decimal DiscountAmount,
    decimal ServiceChargeAmount,
    decimal TaxAmount,
    decimal Total,
    decimal PaidAmount,
    decimal RemainingAmount,
    string? Comment,
    string? CancelReason,
    DateTime OpenedAt,
    DateTime? ClosedAt,
    IReadOnlyList<PaymentDto> Payments,
    IReadOnlyList<OrderHistoryDto> History,
    OrderCustomerDto? Customer,
    decimal LoyaltyDiscountAmount)
{
    /// <summary>F2: true while the order is split into bills (items/discount locked).</summary>
    public bool IsSplit { get; init; }

    /// <summary>F2: bills ordered by number (empty when not split).</summary>
    public IReadOnlyList<OrderBillDto> Bills { get; init; } = [];
}

/// <summary>Body item of <c>POST /orders</c> and <c>POST /orders/{id}/items</c>.</summary>
public sealed record AddItemRequest(
    Guid MenuItemId,
    Guid? VariantId,
    decimal Quantity,
    IReadOnlyList<Guid>? ModifierOptionIds,
    string? Comment);

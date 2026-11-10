using Restaurant.Domain.Entities.Orders;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Orders.Common;

public sealed record OrderBillItemDto(Guid OrderItemId, decimal Quantity, decimal Amount);

/// <summary>F2 sub-check: Σ amounts == order total; <c>remainingAmount = amount − paidAmount</c>.</summary>
public sealed record OrderBillDto(
    Guid Id,
    int Number,
    BillSplitMode Mode,
    decimal Amount,
    decimal PaidAmount,
    decimal RemainingAmount,
    OrderBillStatus Status,
    IReadOnlyList<OrderBillItemDto> Items)
{
    public static OrderBillDto From(OrderBill b) => new(
        b.Id, b.Number, b.Mode, b.Amount, b.PaidAmount, b.RemainingAmount, b.Status,
        b.Items.Select(i => new OrderBillItemDto(i.OrderItemId, i.Quantity, i.Amount)).ToList());
}

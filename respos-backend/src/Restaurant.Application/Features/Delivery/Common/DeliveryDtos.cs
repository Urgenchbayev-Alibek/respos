using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Delivery;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Delivery.Common;

public sealed record CourierDto(Guid Id, string Name, string Phone, bool IsActive)
{
    public static CourierDto From(Courier c) => new(c.Id, c.Name, c.Phone, c.IsActive);
}

public sealed record DeliveryItemDto(Guid Id, string Name, string? VariantName, decimal Quantity, OrderItemStatus Status, decimal LineTotal);

/// <summary>A delivery order card on the board: order money + delivery details + status timestamps.</summary>
public sealed record DeliveryOrderDto(
    Guid OrderId,
    int OrderNumber,
    string DisplayNumber,
    OrderStatus OrderStatus,
    DeliveryStatus Status,
    IReadOnlyList<DeliveryStatus> AllowedTransitions,
    string CustomerName,
    string CustomerPhone,
    string Address,
    string? Entrance,
    string? Floor,
    string? Apartment,
    string? Comment,
    CourierDto? Courier,
    IReadOnlyList<DeliveryItemDto> Items,
    decimal Subtotal,
    decimal DiscountAmount,
    decimal DeliveryFee,
    decimal Total,
    decimal PaidAmount,
    decimal RemainingAmount,
    DateTime CreatedAt,
    DateTime StatusChangedAt,
    DateTime? AcceptedAt,
    DateTime? CookingAt,
    DateTime? ReadyAt,
    DateTime? OnTheWayAt,
    DateTime? DeliveredAt,
    DateTime? CancelledAt,
    string? CancelReason);

/// <summary>Customer + address fields shared by create and update requests.</summary>
public interface IDeliveryDetailsRequest
{
    string CustomerName { get; }
    string CustomerPhone { get; }
    string Address { get; }
    string? Entrance { get; }
    string? Floor { get; }
    string? Apartment { get; }
    string? Comment { get; }
}

public static class DeliveryDetails
{
    public const int AddressMaxLength = 500;
    public const int ShortMaxLength = 32;
    public const int CommentMaxLength = 1000;

    public static DeliveryAddress ToAddress(this IDeliveryDetailsRequest r) =>
        new(r.CustomerName, PhoneNumbers.Normalize(r.CustomerPhone)!, r.Address, r.Entrance, r.Floor, r.Apartment, r.Comment);
}

using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Kitchen.Common;

public sealed record KitchenTicketItemDto(
    Guid Id,
    Guid OrderItemId,
    string Name,
    string? VariantName,
    decimal Quantity,
    IReadOnlyList<string> Modifiers,
    string? Comment,
    KitchenTicketItemStatus Status);

public sealed record KitchenTicketDto(
    Guid Id,
    int Number,
    Guid OrderId,
    int OrderNumber,
    string? TableNumber,
    string? WaiterName,
    Guid StationId,
    string StationName,
    KitchenTicketStatus Status,
    DateTime CreatedAt,
    DateTime? StartedAt,
    DateTime? ReadyAt,
    IReadOnlyList<KitchenTicketItemDto> Items);

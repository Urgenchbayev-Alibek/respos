using Restaurant.Domain.Entities.Floor;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Floor.Common;

public sealed record DiningAreaDto(Guid Id, string Name, int SortOrder, bool IsActive, int TableCount);

public sealed record NextReservationDto(Guid Id, DateTime StartsAt, string GuestName);

public sealed record TableDto(
    Guid Id,
    string Number,
    int Capacity,
    Guid AreaId,
    string AreaName,
    TableStatus Status,
    bool IsActive,
    decimal? PosX,
    decimal? PosY,
    Guid? ActiveOrderId,
    decimal? ActiveOrderTotal,
    NextReservationDto? NextReservation);

public static class FloorRules
{
    public const int NumberMaxLength = 20;
    public const int MaxCapacity = 100;
    public const decimal MaxPosition = 9_999_999m;
}

/// <summary>Realtime payload for <c>TableUpdated</c> (REALTIME.md).</summary>
public static class TableEvents
{
    public static object Payload(DiningTable table, DateTime occurredAt) =>
        new { tableId = table.Id, status = table.Status, branchId = table.BranchId, occurredAt };
}

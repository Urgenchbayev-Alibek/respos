using Restaurant.Domain.Entities.Reservations;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Reservations.Common;

public sealed record ReservationDto(
    Guid Id,
    Guid? TableId,
    string? TableNumber,
    Guid? PreferredAreaId,
    string GuestName,
    string GuestPhone,
    int GuestCount,
    DateTime StartsAt,
    DateTime EndsAt,
    string? Comment,
    ReservationStatus Status,
    string? CancelReason,
    DateTime CreatedAt)
{
    public static ReservationDto From(TableReservation r, string? tableNumber) => new(
        r.Id, r.TableId, tableNumber, r.PreferredAreaId, r.GuestName, r.GuestPhone, r.GuestCount,
        r.StartsAt, r.EndsAt, r.Comment, r.Status, r.CancelReason, r.CreatedAt);
}

public static class ReservationLimits
{
    public const int MaxGuests = 500;
    public const int CommentMaxLength = 1000;
    public const int ReasonMaxLength = 500;
}

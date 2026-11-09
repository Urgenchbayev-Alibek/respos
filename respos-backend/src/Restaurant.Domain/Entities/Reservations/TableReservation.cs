using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;

namespace Restaurant.Domain.Entities.Reservations;

public class TableReservation : AuditableEntity, IBranchScoped
{
    public static readonly ReservationStatus[] ActiveStatuses =
        [ReservationStatus.Pending, ReservationStatus.Confirmed, ReservationStatus.Seated];

    public Guid OrganizationId { get; set; }
    public Guid BranchId { get; set; }
    public Guid? TableId { get; set; }
    public Guid? PreferredAreaId { get; set; }
    public string GuestName { get; set; } = string.Empty;
    public string GuestPhone { get; set; } = string.Empty;
    public int GuestCount { get; set; }
    public DateTime StartsAt { get; set; }
    public DateTime EndsAt { get; set; }
    public string? Comment { get; set; }
    public ReservationStatus Status { get; set; } = ReservationStatus.Pending;
    public string? CancelReason { get; set; }

    public bool IsActive => ActiveStatuses.Contains(Status);

    /// <summary>Half-open interval overlap: [StartsAt, EndsAt) vs [start, end).</summary>
    public bool Overlaps(DateTime start, DateTime end) => StartsAt < end && start < EndsAt;
}

/// <summary>Reservation rules shared by handlers (overlap check on the same table).</summary>
public static class ReservationRules
{
    public static readonly Error InvalidPeriod =
        Error.Validation("reservation.invalid_period", "End time must be after start time.");

    public static readonly Error TimeConflict =
        Error.Conflict("reservation.time_conflict", "The table already has an active reservation for this time.");

    /// <summary>
    /// True when another active reservation for <paramref name="tableId"/> overlaps [start, end).
    /// <paramref name="existing"/> may contain any reservations; non-matching ones are ignored.
    /// </summary>
    public static bool HasConflict(
        IEnumerable<TableReservation> existing, Guid tableId, DateTime start, DateTime end, Guid? excludeReservationId = null) =>
        existing.Any(r => r.TableId == tableId
                          && r.Id != excludeReservationId
                          && r.IsActive
                          && r.Overlaps(start, end));

    public static Result ValidatePeriod(DateTime start, DateTime end) =>
        end > start ? Result.Success() : Result.Failure(InvalidPeriod);
}

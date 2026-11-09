using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;
using Restaurant.Domain.Exceptions;

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

    /// <summary>Details (time, table, guest) can change only before guests are seated.</summary>
    public bool IsEditable => Status is ReservationStatus.Pending or ReservationStatus.Confirmed;

    public void EnsureEditable()
    {
        if (!IsEditable)
        {
            throw new DomainException(ReservationRules.NotEditable);
        }
    }

    public void Confirm() => TransitionTo(ReservationStatus.Confirmed);

    public void Seat()
    {
        if (TableId is null)
        {
            throw new DomainException(ReservationRules.TableRequired);
        }

        TransitionTo(ReservationStatus.Seated);
    }

    public void Complete() => TransitionTo(ReservationStatus.Completed);

    public void MarkNoShow() => TransitionTo(ReservationStatus.NoShow);

    public void Cancel(string? reason)
    {
        TransitionTo(ReservationStatus.Cancelled);
        CancelReason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
    }

    private void TransitionTo(ReservationStatus target)
    {
        if (!ReservationRules.CanTransition(Status, target))
        {
            throw new DomainException(ReservationRules.InvalidTransition(Status, target));
        }

        Status = target;
    }
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

    public static readonly Error NotFound = Error.NotFound("reservation.not_found", "Reservation not found.");

    public static readonly Error NotEditable =
        Error.Conflict("reservation.not_editable", "Only pending or confirmed reservations can be changed.");

    public static readonly Error TableRequired =
        Error.BusinessRule("reservation.table_required", "Assign a table before seating the guests.");

    /// <summary>BR-5.1: pending → confirmed → seated → completed; pending|confirmed → cancelled|no_show.</summary>
    private static readonly Dictionary<ReservationStatus, ReservationStatus[]> Transitions = new()
    {
        [ReservationStatus.Pending] = [ReservationStatus.Confirmed, ReservationStatus.Cancelled, ReservationStatus.NoShow],
        [ReservationStatus.Confirmed] = [ReservationStatus.Seated, ReservationStatus.Cancelled, ReservationStatus.NoShow],
        [ReservationStatus.Seated] = [ReservationStatus.Completed],
    };

    public static bool CanTransition(ReservationStatus from, ReservationStatus to) =>
        Transitions.TryGetValue(from, out var targets) && targets.Contains(to);

    public static Error InvalidTransition(ReservationStatus from, ReservationStatus to) =>
        Error.Conflict("reservation.invalid_status_transition", $"Cannot change reservation status from {from} to {to}.");

    public static Result ValidatePeriod(DateTime start, DateTime end) =>
        end > start ? Result.Success() : Result.Failure(InvalidPeriod);
}

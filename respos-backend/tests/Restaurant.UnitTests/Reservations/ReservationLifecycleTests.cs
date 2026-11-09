using Restaurant.Domain.Entities.Reservations;
using Restaurant.Domain.Enums;
using Restaurant.Domain.Exceptions;

namespace Restaurant.UnitTests.Reservations;

public sealed class ReservationLifecycleTests
{
    private static TableReservation Reservation(ReservationStatus status, Guid? tableId = null) => new()
    {
        TableId = tableId ?? Guid.NewGuid(),
        GuestName = "Guest",
        GuestPhone = "+998901234567",
        GuestCount = 2,
        Status = status,
    };

    [Fact]
    public void Happy_path_pending_to_completed()
    {
        var reservation = Reservation(ReservationStatus.Pending);

        reservation.Confirm();
        reservation.Seat();
        reservation.Complete();

        reservation.Status.Should().Be(ReservationStatus.Completed);
    }

    [Theory]
    [InlineData(ReservationStatus.Pending)]
    [InlineData(ReservationStatus.Confirmed)]
    public void Pending_or_confirmed_can_be_cancelled_or_no_show(ReservationStatus status)
    {
        var cancelled = Reservation(status);
        cancelled.Cancel("  guest called  ");
        cancelled.Status.Should().Be(ReservationStatus.Cancelled);
        cancelled.CancelReason.Should().Be("guest called");

        var noShow = Reservation(status);
        noShow.MarkNoShow();
        noShow.Status.Should().Be(ReservationStatus.NoShow);
    }

    public static TheoryData<ReservationStatus, Action<TableReservation>> InvalidTransitions => new()
    {
        { ReservationStatus.Pending, r => r.Seat() },
        { ReservationStatus.Pending, r => r.Complete() },
        { ReservationStatus.Confirmed, r => r.Confirm() },
        { ReservationStatus.Confirmed, r => r.Complete() },
        { ReservationStatus.Seated, r => r.Cancel(null) },
        { ReservationStatus.Seated, r => r.MarkNoShow() },
        { ReservationStatus.Completed, r => r.Cancel(null) },
        { ReservationStatus.Cancelled, r => r.Confirm() },
        { ReservationStatus.NoShow, r => r.Seat() },
    };

    [Theory]
    [MemberData(nameof(InvalidTransitions))]
    public void Invalid_transitions_are_conflicts(ReservationStatus status, Action<TableReservation> action)
    {
        var reservation = Reservation(status);

        var act = () => action(reservation);

        act.Should().Throw<DomainException>().Which.Error.Code.Should().Be("reservation.invalid_status_transition");
        reservation.Status.Should().Be(status);
    }

    [Fact]
    public void Seat_requires_a_table()
    {
        var reservation = Reservation(ReservationStatus.Confirmed);
        reservation.TableId = null;

        var act = () => reservation.Seat();

        act.Should().Throw<DomainException>().Which.Error.Code.Should().Be("reservation.table_required");
    }

    [Theory]
    [InlineData(ReservationStatus.Pending, true)]
    [InlineData(ReservationStatus.Confirmed, true)]
    [InlineData(ReservationStatus.Seated, false)]
    [InlineData(ReservationStatus.Completed, false)]
    [InlineData(ReservationStatus.Cancelled, false)]
    public void Only_pending_or_confirmed_are_editable(ReservationStatus status, bool editable)
    {
        Reservation(status).IsEditable.Should().Be(editable);
    }
}

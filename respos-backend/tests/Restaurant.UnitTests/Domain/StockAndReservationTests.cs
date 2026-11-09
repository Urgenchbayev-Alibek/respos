using Restaurant.Domain.Entities.Inventory;
using Restaurant.Domain.Entities.Reservations;
using Restaurant.Domain.Enums;
using Restaurant.Domain.Events;
using Restaurant.Domain.Exceptions;

namespace Restaurant.UnitTests.Domain;

public sealed class StockBalanceTests
{
    private static readonly Guid Org = Guid.NewGuid();
    private static readonly Guid Branch = Guid.NewGuid();
    private static readonly Guid IngredientId = Guid.NewGuid();

    private static StockMovement Movement(decimal quantity, StockMovementType type = StockMovementType.Adjustment) => new()
    {
        OrganizationId = Org,
        BranchId = Branch,
        IngredientId = IngredientId,
        Quantity = quantity,
        Type = type,
    };

    [Fact]
    public void Apply_updates_balance_and_stamps_balance_after()
    {
        var balance = StockBalance.Create(Org, Branch, IngredientId);
        var receipt = Movement(10.5m, StockMovementType.Receipt);
        var writeOff = Movement(-2.25m, StockMovementType.WriteOff);

        balance.Apply(receipt, allowNegative: false);
        balance.Apply(writeOff, allowNegative: false);

        balance.Quantity.Should().Be(8.25m);
        receipt.BalanceAfter.Should().Be(10.5m);
        writeOff.BalanceAfter.Should().Be(8.25m);
    }

    [Fact]
    public void Negative_result_is_rejected_unless_allowed()
    {
        var balance = StockBalance.Create(Org, Branch, IngredientId);
        balance.Apply(Movement(1m), false);

        balance.Invoking(b => b.Apply(Movement(-2m), false)).Should().Throw<DomainException>()
            .Which.Error.Code.Should().Be("stock.insufficient");
        balance.Quantity.Should().Be(1m);

        balance.Apply(Movement(-2m, StockMovementType.Consumption), allowNegative: true);
        balance.Quantity.Should().Be(-1m);
    }

    [Fact]
    public void Movement_of_another_ingredient_is_refused()
    {
        var balance = StockBalance.Create(Org, Branch, Guid.NewGuid());

        balance.Invoking(b => b.Apply(Movement(1m), false)).Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void Crossing_minimum_raises_stock_low_once()
    {
        var balance = StockBalance.Create(Org, Branch, IngredientId, minQuantity: 5m);
        balance.Apply(Movement(10m), false);

        balance.Apply(Movement(-6m), false);
        balance.Apply(Movement(-1m), false);

        balance.DomainEvents.OfType<StockLowDomainEvent>().Should().ContainSingle()
            .Which.Quantity.Should().Be(4m);
    }
}

public sealed class ReservationRulesTests
{
    private static readonly Guid Table = Guid.NewGuid();
    private static readonly DateTime Base = new(2026, 11, 10, 12, 0, 0, DateTimeKind.Utc);

    private static TableReservation Reservation(int startHour, int endHour, ReservationStatus status = ReservationStatus.Confirmed) => new()
    {
        TableId = Table,
        StartsAt = Base.AddHours(startHour),
        EndsAt = Base.AddHours(endHour),
        Status = status,
    };

    [Theory]
    [InlineData(1, 3, true)]   // overlaps the tail
    [InlineData(-1, 1, true)]  // overlaps the head
    [InlineData(0, 2, true)]   // identical
    [InlineData(2, 4, false)]  // starts exactly at end (half-open)
    [InlineData(-2, 0, false)] // ends exactly at start
    public void Overlap_uses_half_open_intervals(int start, int end, bool conflict)
    {
        var existing = new[] { Reservation(0, 2) };

        ReservationRules.HasConflict(existing, Table, Base.AddHours(start), Base.AddHours(end)).Should().Be(conflict);
    }

    [Theory]
    [InlineData(ReservationStatus.Cancelled)]
    [InlineData(ReservationStatus.Completed)]
    [InlineData(ReservationStatus.NoShow)]
    public void Inactive_reservations_do_not_conflict(ReservationStatus status)
    {
        var existing = new[] { Reservation(0, 2, status) };

        ReservationRules.HasConflict(existing, Table, Base, Base.AddHours(2)).Should().BeFalse();
    }

    [Fact]
    public void Same_reservation_and_other_tables_are_ignored()
    {
        var own = Reservation(0, 2);
        var other = Reservation(0, 2);
        other.TableId = Guid.NewGuid();

        ReservationRules.HasConflict([own, other], Table, Base, Base.AddHours(2), own.Id).Should().BeFalse();
    }

    [Fact]
    public void Period_must_end_after_start() =>
        ReservationRules.ValidatePeriod(Base, Base).IsFailure.Should().BeTrue();
}

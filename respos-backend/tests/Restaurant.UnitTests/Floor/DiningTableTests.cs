using Restaurant.Domain.Entities.Floor;
using Restaurant.Domain.Enums;
using Restaurant.Domain.Exceptions;

namespace Restaurant.UnitTests.Floor;

public sealed class DiningTableTests
{
    private static readonly DateTime Now = new(2026, 11, 10, 8, 0, 0, DateTimeKind.Utc);

    private static DiningTable Table(TableStatus status = TableStatus.Available) =>
        new() { Number = "1", Capacity = 4, Status = status };

    [Theory]
    [InlineData(TableStatus.Available, TableStatus.Unavailable)]
    [InlineData(TableStatus.Unavailable, TableStatus.Available)]
    [InlineData(TableStatus.Occupied, TableStatus.Available)]
    public void Manual_status_accepts_available_and_unavailable(TableStatus from, TableStatus to)
    {
        var table = Table(from);

        table.SetManualStatus(to, hasActiveOrder: false).Should().BeTrue();

        table.Status.Should().Be(to);
    }

    [Theory]
    [InlineData(TableStatus.Occupied)]
    [InlineData(TableStatus.Reserved)]
    public void Manual_status_rejects_system_statuses(TableStatus status)
    {
        var act = () => Table().SetManualStatus(status, hasActiveOrder: false);

        act.Should().Throw<DomainException>().Which.Error.Code.Should().Be("table.invalid_status");
    }

    [Fact]
    public void Manual_status_is_refused_while_an_order_is_active()
    {
        var act = () => Table(TableStatus.Occupied).SetManualStatus(TableStatus.Available, hasActiveOrder: true);

        act.Should().Throw<DomainException>().Which.Error.Code.Should().Be("table.has_active_order");
    }

    [Fact]
    public void Archived_table_is_not_usable()
    {
        var table = Table();
        table.Archive(Now);

        table.Invoking(t => t.SetManualStatus(TableStatus.Unavailable, false))
            .Should().Throw<DomainException>().Which.Error.Code.Should().Be("table.archived");
        table.Invoking(t => t.Occupy()).Should().Throw<DomainException>().Which.Error.Code.Should().Be("table.archived");
        table.IsActive.Should().BeFalse();
    }

    [Fact]
    public void Unavailable_table_cannot_be_occupied()
    {
        var act = () => Table(TableStatus.Unavailable).Occupy();

        act.Should().Throw<DomainException>().Which.Error.Code.Should().Be("table.unavailable");
    }

    [Fact]
    public void Occupy_reports_change_only_once()
    {
        var table = Table();

        table.Occupy().Should().BeTrue();
        table.Occupy().Should().BeFalse();
        table.Status.Should().Be(TableStatus.Occupied);
    }

    [Theory]
    [InlineData(TableStatus.Occupied, false, true, TableStatus.Available)]
    [InlineData(TableStatus.Reserved, false, true, TableStatus.Available)]
    [InlineData(TableStatus.Occupied, true, false, TableStatus.Occupied)]
    [InlineData(TableStatus.Unavailable, false, false, TableStatus.Unavailable)]
    [InlineData(TableStatus.Available, false, false, TableStatus.Available)]
    public void Release_frees_only_idle_busy_tables(TableStatus from, bool activeOrder, bool changed, TableStatus expected)
    {
        var table = Table(from);

        table.ReleaseIfIdle(activeOrder).Should().Be(changed);

        table.Status.Should().Be(expected);
    }
}

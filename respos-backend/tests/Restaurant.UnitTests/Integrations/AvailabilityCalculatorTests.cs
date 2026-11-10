using Restaurant.Application.Features.Reservations.Availability;

namespace Restaurant.UnitTests.Integrations;

public sealed class AvailabilityCalculatorTests
{
    private static readonly DateOnly Date = new(2026, 12, 1);
    private static readonly TimeZoneInfo Zone = TimeZoneInfo.Utc;
    private static readonly SlotGrid Grid = new(new TimeOnly(18, 0), new TimeOnly(21, 0), 60, 120);
    private static readonly Guid AreaId = Guid.NewGuid();
    private static readonly AvailabilityTable Small = new(Guid.NewGuid(), "1", 2, AreaId, "Зал");
    private static readonly AvailabilityTable Big = new(Guid.NewGuid(), "2", 6, AreaId, "Зал");

    private static DateTime At(int hour) => new(2026, 12, 1, hour, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void Overlapping_reservation_blocks_the_table_on_half_open_intervals()
    {
        var busy = new[] { new BusyInterval(Small.Id, At(19), At(21)) };
        var slots = AvailabilityCalculator.Calculate(Date, Zone, Grid, 2, [Small], busy, At(0));

        slots.Select(s => s.Time).Should().Equal("18:00", "19:00", "20:00", "21:00");
        slots.Single(s => s.Time == "18:00").FreeTables.Should().BeEmpty("18:00–20:00 overlaps 19:00–21:00");
        slots.Single(s => s.Time == "19:00").FreeTables.Should().BeEmpty();
        slots.Single(s => s.Time == "20:00").FreeTables.Should().BeEmpty();
        slots.Single(s => s.Time == "21:00").FreeTables.Should().ContainSingle("21:00 starts exactly when the booking ends");
    }

    [Fact]
    public void Capacity_filters_tables_and_smallest_fitting_table_comes_first()
    {
        var slots = AvailabilityCalculator.Calculate(Date, Zone, Grid, 2, [Big, Small], [], At(0));
        slots[0].FreeTables.Select(t => t.Number).Should().Equal("1", "2");

        var party = AvailabilityCalculator.Calculate(Date, Zone, Grid, 5, [Big, Small], [], At(0));
        party[0].FreeTables.Should().ContainSingle().Which.Number.Should().Be("2");
    }

    [Fact]
    public void Slots_before_the_lead_time_have_no_free_tables()
    {
        var slots = AvailabilityCalculator.Calculate(Date, Zone, Grid, 2, [Small], [], At(20));
        slots.Where(s => s.StartsAt < At(20)).Should().OnlyContain(s => s.FreeTables.Count == 0);
        slots.Single(s => s.Time == "20:00").FreeTables.Should().ContainSingle();
    }

    [Fact]
    public void Slot_times_are_converted_from_the_branch_timezone()
    {
        var tashkent = TimeZoneInfo.FindSystemTimeZoneById("Asia/Tashkent");
        var slots = AvailabilityCalculator.Calculate(Date, tashkent, Grid, 1, [Small], [], DateTime.MinValue);
        slots[0].StartsAt.Should().Be(At(13), "18:00 in Tashkent (UTC+5) is 13:00 UTC");
        slots[0].EndsAt.Should().Be(At(15));
    }
}

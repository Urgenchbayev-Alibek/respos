using Restaurant.Application.Features.Staff.Pin;
using Restaurant.Domain.Entities.Staff;
using Restaurant.Domain.Exceptions;

namespace Restaurant.UnitTests.Staff;

public sealed class StaffDomainTests
{
    private static readonly DateTime Now = new(2026, 11, 10, 12, 0, 0, DateTimeKind.Utc);

    [Theory]
    [InlineData("2580", true)]
    [InlineData("482613", true)]
    [InlineData("1111", false)]
    [InlineData("1234", false)]
    [InlineData("654321", false)]
    [InlineData("123", false)]
    [InlineData("1234567", false)]
    [InlineData("12a4", false)]
    [InlineData("٢٥٨٠", false)]
    public void Pin_policy(string pin, bool valid) => PinPolicy.IsValid(pin).Should().Be(valid);

    [Fact]
    public void Clock_out_computes_worked_minutes_and_cannot_repeat()
    {
        var entry = TimeEntry.ClockIn(Guid.NewGuid(), Guid.NewGuid(), Now, null);
        entry.ClockOut(Now.AddMinutes(125), 20, "done");
        entry.WorkedMinutes(Now.AddDays(1)).Should().Be(105);
        entry.IsOpen.Should().BeFalse();
        FluentActions.Invoking(() => entry.ClockOut(Now.AddMinutes(130), null, null))
            .Should().Throw<DomainException>().Which.Error.Should().Be(TimeEntryErrors.NotOpen);
    }

    [Fact]
    public void Break_longer_than_worked_time_is_rejected()
    {
        var entry = TimeEntry.ClockIn(Guid.NewGuid(), Guid.NewGuid(), Now, null);
        FluentActions.Invoking(() => entry.ClockOut(Now.AddMinutes(10), 30, null))
            .Should().Throw<DomainException>().Which.Error.Should().Be(TimeEntryErrors.InvalidBreak);
    }

    [Fact]
    public void Correction_keeps_editor_and_reason()
    {
        var entry = TimeEntry.ClockIn(Guid.NewGuid(), Guid.NewGuid(), Now.AddHours(-5), null);
        var editor = Guid.NewGuid();
        entry.Correct(Now.AddHours(-4), Now.AddHours(-1), 0, null, editor, "forgot", Now);
        entry.EditedBy.Should().Be(editor);
        entry.EditReason.Should().Be("forgot");
        entry.WorkedMinutes(Now).Should().Be(180);
    }

    [Fact]
    public void Overnight_shift_minutes_and_overlap()
    {
        ShiftSchedule.CalculateMinutes(new TimeOnly(22, 0), new TimeOnly(6, 0)).Should().Be(480);
        var night = ShiftSchedule.AbsoluteRange(new DateOnly(2026, 11, 16), new TimeOnly(22, 0), new TimeOnly(6, 0));
        var morning = ShiftSchedule.AbsoluteRange(new DateOnly(2026, 11, 17), new TimeOnly(5, 0), new TimeOnly(9, 0));
        var later = ShiftSchedule.AbsoluteRange(new DateOnly(2026, 11, 17), new TimeOnly(6, 0), new TimeOnly(9, 0));
        ShiftSchedule.Overlaps(night, morning).Should().BeTrue();
        ShiftSchedule.Overlaps(night, later).Should().BeFalse();
    }

    [Fact]
    public void Pin_and_device_lockouts()
    {
        var pin = StaffPin.Create(Guid.NewGuid(), "hash", Guid.NewGuid(), Now);
        for (var i = 0; i < 4; i++)
        {
            pin.RegisterFailure(Now, 5, TimeSpan.FromMinutes(15)).Should().BeFalse();
        }

        pin.RegisterFailure(Now, 5, TimeSpan.FromMinutes(15)).Should().BeTrue();
        pin.IsLockedOut(Now.AddMinutes(14)).Should().BeTrue();
        pin.IsLockedOut(Now.AddMinutes(16)).Should().BeFalse();

        var device = StaffDevice.Register(Guid.NewGuid(), Guid.NewGuid(), "Tablet", "hash", Now.AddDays(1));
        device.IsActive(Now).Should().BeTrue();
        device.Revoke(null, Now);
        device.IsActive(Now).Should().BeFalse();
    }
}

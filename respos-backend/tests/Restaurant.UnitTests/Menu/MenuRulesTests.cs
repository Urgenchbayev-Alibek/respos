using Restaurant.Application.Features.Menu.Common;
using Restaurant.Application.Features.Menu.ModifierGroups;
using Restaurant.Domain.Entities.Menu;

namespace Restaurant.UnitTests.Menu;

public sealed class MenuAvailabilityTests
{
    // 2026-11-10 is a Tuesday.
    private static DateTime At(int day, int hour, int minute = 0) => new(2026, 11, day, hour, minute, 0, DateTimeKind.Unspecified);

    private static MenuAvailability Window(int startHour, int endHour, DayOfWeek? day = null) =>
        new() { DayOfWeek = day, StartTime = new TimeOnly(startHour, 0), EndTime = new TimeOnly(endHour, 0) };

    [Theory]
    [InlineData(10, 59, false)]
    [InlineData(11, 0, true)]
    [InlineData(15, 59, true)]
    [InlineData(16, 0, false)]
    public void Daily_window_is_half_open(int hour, int minute, bool covered)
    {
        Window(11, 16).Covers(At(10, hour, minute)).Should().Be(covered);
    }

    [Fact]
    public void Day_specific_window_applies_only_on_that_day()
    {
        var tuesdayLunch = Window(11, 16, DayOfWeek.Tuesday);

        tuesdayLunch.Covers(At(10, 12)).Should().BeTrue();
        tuesdayLunch.Covers(At(11, 12)).Should().BeFalse();
    }

    [Theory]
    [InlineData(10, 23, true)]
    [InlineData(11, 1, true)]
    [InlineData(11, 3, false)]
    [InlineData(10, 21, false)]
    public void Overnight_window_spans_midnight_and_belongs_to_start_day(int day, int hour, bool covered)
    {
        Window(22, 2, DayOfWeek.Tuesday).Covers(At(day, hour)).Should().Be(covered);
    }

    [Fact]
    public void Item_without_windows_is_orderable_all_day_unless_archived_or_unavailable()
    {
        var item = new MenuItem { Name = "Плов", IsAvailable = true };
        item.IsOrderableAt(At(10, 3)).Should().BeTrue();

        item.IsAvailable = false;
        item.IsOrderableAt(At(10, 3)).Should().BeFalse();

        var archived = new MenuItem { Name = "Old", IsAvailable = true };
        archived.Archive(DateTime.UtcNow);
        archived.IsOrderableAt(At(10, 3)).Should().BeFalse();
    }

    [Fact]
    public void Item_with_windows_is_orderable_only_inside_any_window()
    {
        var item = new MenuItem { Name = "Завтрак", IsAvailable = true, Availability = [Window(8, 11), Window(18, 20)] };

        item.IsOrderableAt(At(10, 9)).Should().BeTrue();
        item.IsOrderableAt(At(10, 19)).Should().BeTrue();
        item.IsOrderableAt(At(10, 13)).Should().BeFalse();
    }
}

public sealed class ModifierRulesTests
{
    [Theory]
    [InlineData(0, 1, false, 2, true)]
    [InlineData(1, 3, true, 3, true)]
    [InlineData(2, 1, false, 3, false)]
    [InlineData(0, 0, false, 3, false)]
    [InlineData(0, 2, true, 3, false)]
    [InlineData(3, 3, false, 2, false)]
    [InlineData(-1, 2, false, 2, false)]
    public void Group_definition_rules(int min, int max, bool required, int options, bool valid)
    {
        ModifierRules.IsValidDefinition(min, max, required, options).Should().Be(valid);
    }

    [Theory]
    [InlineData(0, true)]
    [InlineData(1, true)]
    [InlineData(2, true)]
    [InlineData(3, false)]
    public void Selection_count_within_min_max(int selected, bool allowed)
    {
        var group = new ModifierGroup { MinSelect = 0, MaxSelect = 2 };

        group.AllowsSelectionCount(selected).Should().Be(allowed);
    }

    [Fact]
    public void Required_group_needs_at_least_one_selection()
    {
        new ModifierGroup { MinSelect = 0, MaxSelect = 2, IsRequired = true }.AllowsSelectionCount(0).Should().BeFalse();
    }

    [Fact]
    public void Validator_rejects_min_greater_than_max_and_required_without_min()
    {
        var validator = new SaveModifierGroupValidator();
        var options = new[] { new ModifierOptionInput(null, "A", 0m), new ModifierOptionInput(null, "B", 1000m) };

        validator.Validate(new SaveModifierGroupCommand("Соусы", 2, 1, false, options)).IsValid.Should().BeFalse();
        validator.Validate(new SaveModifierGroupCommand("Соусы", 0, 1, true, options)).IsValid.Should().BeFalse();
        validator.Validate(new SaveModifierGroupCommand("Соусы", 1, 2, true, options)).IsValid.Should().BeTrue();
    }
}

public sealed class MenuPhotoRulesTests
{
    private static readonly byte[] PngBytes = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0];
    private static readonly byte[] JpegBytes = [0xFF, 0xD8, 0xFF, 0xE0, 0, 0];
    private static readonly byte[] WebpBytes = "RIFF\0\0\0\0WEBPVP8 "u8.ToArray();

    [Theory]
    [InlineData("png", "image/png", "a.png", ".png")]
    [InlineData("jpg", "image/jpeg", "a.JPEG", ".jpg")]
    [InlineData("webp", "image/webp", "a.webp", ".webp")]
    public void Accepts_matching_signature_type_and_extension(string kind, string contentType, string fileName, string extension)
    {
        var bytes = kind switch { "png" => PngBytes, "jpg" => JpegBytes, _ => WebpBytes };

        MenuPhotoRules.Detect(bytes, contentType, fileName)!.Value.Extension.Should().Be(extension);
    }

    [Theory]
    [InlineData("image/png", "a.jpg")]
    [InlineData("image/gif", "a.png")]
    [InlineData("image/png", "a.svg")]
    public void Rejects_mismatched_type_or_extension(string contentType, string fileName)
    {
        MenuPhotoRules.Detect(PngBytes, contentType, fileName).Should().BeNull();
    }

    [Fact]
    public void Rejects_content_that_is_not_an_image()
    {
        MenuPhotoRules.Detect("<svg></svg>"u8, "image/png", "a.png").Should().BeNull();
    }
}

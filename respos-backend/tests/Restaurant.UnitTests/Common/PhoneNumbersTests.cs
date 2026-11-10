using Restaurant.Domain.Common;

namespace Restaurant.UnitTests.Common;

/// <summary>The single phone normalization used by guests, delivery, couriers, online reservations and SMS.</summary>
public sealed class PhoneNumbersTests
{
    [Theory]
    [InlineData("+998 90 123 45 67", "+998901234567")]
    [InlineData("998901234567", "+998901234567")]
    [InlineData("90 123-45-67", "+998901234567")]
    [InlineData("(93) 765 43 21", "+998937654321")]
    [InlineData("  +998(71)2001020 ", "+998712001020")]
    [InlineData("+7 701 123 45 67", "+77011234567")]
    [InlineData("+7 916 123 45 67", "+79161234567")]
    [InlineData("12345", null)]
    [InlineData("+99890123", null)]
    [InlineData("99890123456789", null)]
    [InlineData("90abc", null)]
    [InlineData("90+1234567", null)]
    [InlineData("call me", null)]
    [InlineData("", null)]
    [InlineData(null, null)]
    public void Normalizes_to_e164(string? input, string? expected) =>
        PhoneNumbers.Normalize(input).Should().Be(expected);

    [Theory]
    [InlineData("90 123 45 67", true)]
    [InlineData("+998 (90) 123-45-67", true)]
    [InlineData("+7 900 123 45 67", false)]
    [InlineData("+901234567", false)]
    [InlineData("90123456a7", false)]
    [InlineData(null, false)]
    public void Uzbek_only_check_for_guests_and_sms(string? input, bool valid)
    {
        PhoneNumbers.TryNormalizeUz(input, out var normalized).Should().Be(valid);
        normalized.Should().Be(valid ? "+998901234567" : string.Empty);
    }

    [Theory]
    [InlineData("+998 90 123", "99890123")]
    [InlineData("998901234567", "901234567")]
    [InlineData("90-12", "9012")]
    public void Search_digits_drop_a_full_country_code_only(string term, string expected) =>
        PhoneNumbers.SearchDigits(term).Should().Be(expected);
}

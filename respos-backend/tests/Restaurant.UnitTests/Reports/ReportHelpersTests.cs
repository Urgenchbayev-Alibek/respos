using System.Text;
using Restaurant.Application.Features.Reports.Common;
using Restaurant.Application.Features.Reports.Export;
using Restaurant.Domain.Enums;

namespace Restaurant.UnitTests.Reports;

public sealed class ReportHelpersTests
{
    private static readonly TimeZoneInfo Tashkent = BranchTime.Resolve("Asia/Tashkent");

    [Fact]
    public void Tashkent_day_starts_at_19_00_utc_of_the_previous_day()
    {
        BranchTime.LocalDate(new DateTime(2026, 11, 9, 19, 0, 0, DateTimeKind.Utc), Tashkent).Should().Be(new DateOnly(2026, 11, 10));
        BranchTime.LocalDate(new DateTime(2026, 11, 9, 18, 59, 59, DateTimeKind.Utc), Tashkent).Should().Be(new DateOnly(2026, 11, 9));

        var range = BranchTime.ToUtcRange(new DateOnly(2026, 11, 10), new DateOnly(2026, 11, 10), Tashkent);
        range.FromUtc.Should().Be(new DateTime(2026, 11, 9, 19, 0, 0, DateTimeKind.Utc));
        range.ToUtc.Should().Be(new DateTime(2026, 11, 10, 19, 0, 0, DateTimeKind.Utc));
    }

    [Fact]
    public void Unknown_timezone_falls_back_to_tashkent()
    {
        BranchTime.Resolve("Mars/Olympus").BaseUtcOffset.Should().Be(TimeSpan.FromHours(5));
    }

    [Theory]
    [InlineData(1000, 3, 333.33)]
    [InlineData(1000, 0, 0)]
    [InlineData(0, 0, 0)]
    [InlineData(100.005, 1, 100.01)]
    public void Average_check_is_revenue_over_orders_rounded_and_zero_without_orders(decimal revenue, int orders, decimal expected)
    {
        ReportMath.AverageCheck(revenue, orders).Should().Be(expected);
    }

    [Theory]
    [InlineData("=SUM(A1:A2)", "'=SUM(A1:A2)")]
    [InlineData("+7 998", "'+7 998")]
    [InlineData("-1", "'-1")]
    [InlineData("@cmd", "'@cmd")]
    [InlineData("Плов", "Плов")]
    [InlineData("a,b", "\"a,b\"")]
    [InlineData("say \"hi\"", "\"say \"\"hi\"\"\"")]
    [InlineData("=1,2", "\"'=1,2\"")]
    [InlineData("line\nbreak", "\"line\nbreak\"")]
    public void Text_cells_are_escaped_and_formula_safe(string input, string expected)
    {
        CsvWriter.EscapeText(input).Should().Be(expected);
    }

    [Fact]
    public void Csv_has_bom_crlf_and_invariant_numbers_without_formula_prefix()
    {
        var bytes = CsvWriter.Write(["method", "amount", "date"],
            [[PaymentMethod.Cash, -1234.5m, new DateOnly(2026, 11, 10)], [null, 0m, null]]);

        bytes.Take(3).Should().Equal(0xEF, 0xBB, 0xBF);
        Encoding.UTF8.GetString(bytes[3..]).Should().Be("method,amount,date\r\ncash,-1234.5,2026-11-10\r\n,0,\r\n");
    }
}

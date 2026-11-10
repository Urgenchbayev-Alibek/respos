using System.Text;
using Restaurant.Application.Abstractions.Reports;
using Restaurant.Application.Features.Reports.Analytics;
using Restaurant.Application.Features.Reports.Common;
using Restaurant.Application.Features.Reports.Export;

namespace Restaurant.UnitTests.Reports;

public sealed class AnalyticsMathTests
{
    private static readonly TimeZoneInfo Tashkent = BranchTime.Resolve("Asia/Tashkent");

    [Fact]
    public void Abc_assigns_classes_by_cumulative_share_before_the_item()
    {
        var ids = Enumerable.Range(0, 6).Select(_ => Guid.NewGuid()).ToArray();
        // Total 100: 50 | 25 (before 50 → A) | 10 (before 75 → A) | 10 (before 85 → B) | 5 (before 95 → C) | 0 → C.
        var result = AnalyticsMath.ClassifyAbc(
        [
            new(ids[3], 10m), new(ids[0], 50m), new(ids[5], 0m), new(ids[1], 25m), new(ids[2], 10m), new(ids[4], 5m),
        ]);

        result.Select(r => r.Id).Should().Equal(ids[0], ids[1], ids[3], ids[2], ids[4], ids[5]);
        result.Select(r => r.Class).Should().Equal("A", "A", "A", "B", "C", "C");
        result.Select(r => r.SharePercent).Should().Equal(50m, 25m, 10m, 10m, 5m, 0m);
        result.Select(r => r.CumulativePercent).Should().Equal(50m, 75m, 85m, 95m, 100m, 100m);
    }

    [Fact]
    public void Abc_top_item_is_always_a_and_negative_margins_are_c()
    {
        var big = Guid.NewGuid();
        var small = Guid.NewGuid();
        var loss = Guid.NewGuid();
        var result = AnalyticsMath.ClassifyAbc([new(small, 5m), new(loss, -20m), new(big, 95m)]);
        result.Single(r => r.Id == big).Class.Should().Be("A");
        result.Single(r => r.Id == small).Class.Should().Be("C");
        var negative = result.Single(r => r.Id == loss);
        negative.Class.Should().Be("C");
        negative.SharePercent.Should().Be(0m);

        AnalyticsMath.ClassifyAbc([]).Should().BeEmpty();
        AnalyticsMath.ClassifyAbc([new(big, 0m)]).Single().Class.Should().Be("C");
    }

    [Theory]
    [InlineData(150, 100, 50.0)]
    [InlineData(50, 160, -68.8)]
    [InlineData(100, 100, 0.0)]
    [InlineData(1, 3, -66.7)]
    public void Delta_percent_is_rounded_to_one_decimal(decimal current, decimal previous, decimal expected) =>
        AnalyticsMath.DeltaPercent(current, previous).Should().Be(expected);

    [Fact]
    public void Delta_percent_is_null_without_a_base() => AnalyticsMath.DeltaPercent(10m, 0m).Should().BeNull();

    [Fact]
    public void Previous_period_has_equal_length_and_ends_the_day_before()
    {
        AnalyticsMath.PreviousPeriod(new DateOnly(2026, 11, 10), new DateOnly(2026, 11, 10))
            .Should().Be((new DateOnly(2026, 11, 9), new DateOnly(2026, 11, 9)));
        AnalyticsMath.PreviousPeriod(new DateOnly(2026, 3, 1), new DateOnly(2026, 3, 7))
            .Should().Be((new DateOnly(2026, 2, 22), new DateOnly(2026, 2, 28)));
    }

    [Fact]
    public void Local_hour_crosses_the_tashkent_midnight_at_19_00_utc()
    {
        var saturdayLate = HourlySalesQueries.LocalHour(new DateTime(2026, 10, 10, 18, 59, 0, DateTimeKind.Utc), Tashkent);
        var sundayStart = HourlySalesQueries.LocalHour(new DateTime(2026, 10, 10, 19, 0, 0, DateTimeKind.Utc), Tashkent);
        saturdayLate.Should().Be(new DateTime(2026, 10, 10, 23, 0, 0));
        sundayStart.Should().Be(new DateTime(2026, 10, 11, 0, 0, 0));

        var map = HeatmapReportHandler.Build([new(saturdayLate, 1, 60m), new(sundayStart, 2, 50m), new(sundayStart.AddDays(7), 1, 10m)]);
        map.Cells.Should().HaveCount(7 * 24);
        map.Cells.Single(c => c.Weekday == 6 && c.Hour == 23).Revenue.Should().Be(60m);
        map.Cells.Single(c => c.Weekday == 7 && c.Hour == 0).Should().Be(new HeatmapCellDto(7, 0, 3, 60m));
        map.MaxRevenue.Should().Be(60m);
        map.MaxOrders.Should().Be(3);
    }

    [Fact]
    public void Food_cost_row_uses_converted_recipe_cost_and_flags_threshold()
    {
        // 250 g of rice at 20 000 per kg: factor g → kg = 0.001.
        var cost = RecipeCostCalculator.LineCost(250m, 0.001m, 20_000m);
        cost.Should().Be(5_000m);

        var cheap = FoodCostReportHandler.Row(Guid.NewGuid(), null, "Плов", null, "Основное", 50_000m, new RecipeCost(Guid.NewGuid(), cost, false), 35m);
        cheap.FoodCostPercent.Should().Be(10m);
        cheap.MarginAmount.Should().Be(45_000m);
        cheap.MarginPercent.Should().Be(90m);
        cheap.IsAboveThreshold.Should().BeFalse();

        var expensive = FoodCostReportHandler.Row(Guid.NewGuid(), null, "Чай", null, "Напитки", 10_000m, new RecipeCost(Guid.NewGuid(), 4_000m, false), 35m);
        expensive.IsAboveThreshold.Should().BeTrue();

        var noRecipe = FoodCostReportHandler.Row(Guid.NewGuid(), null, "Хлеб", null, "Основное", 3_000m, null, 35m);
        noRecipe.HasRecipe.Should().BeFalse();
        noRecipe.FoodCostPercent.Should().BeNull();
        noRecipe.IsAboveThreshold.Should().BeFalse();
    }

    [Fact]
    public void Print_html_encodes_values_has_no_script_and_formats_branch_time()
    {
        var labels = ReportLabels.For("ru");
        var document = new ReportDocument("z", "Z-отчёт <b>", null, Tashkent,
            [new ReportSummaryLine("Открыта", new DateTime(2026, 10, 10, 19, 30, 0, DateTimeKind.Utc), ReportCellKind.DateTime)],
            [new ReportSheet("Оплаты", [new("id", "Id", ReportCellKind.Id), new("name", "Имя"), new("amount", "Сумма", ReportCellKind.Money)],
                [[Guid.NewGuid(), "<script>alert(1)</script>", 1234.5m]])],
            labels.Value);

        var html = Encoding.UTF8.GetString(PrintHtmlWriter.Write(document, labels, new DateTime(2026, 10, 11, 0, 0, 0, DateTimeKind.Utc)));

        html.Should().StartWith("<!doctype html>");
        html.Should().NotContain("<script");
        html.Should().Contain("&lt;script&gt;alert(1)&lt;/script&gt;");
        html.Should().Contain("Z-отчёт &lt;b&gt;");
        html.Should().Contain("11.10.2026 00:30");
        html.Should().NotContain(">Id<");
    }

    [Fact]
    public void Labels_fall_back_to_russian_and_keep_unknown_enum_values()
    {
        ReportLabels.For("de")["revenue"].Should().Be("Выручка");
        ReportLabels.For("uz")["revenue"].Should().Be("Tushum");
        ReportLabels.For("en").Value(AbcMetric.Margin).Should().Be("By margin");
        ReportLabels.For("en").Value(true).Should().Be("Yes");
        ReportLabels.For("en").Value(Restaurant.Domain.Enums.StockMovementType.WriteOff).Should().Be("write_off");
        ReportLabels.For("ru").Weekday(7).Should().Be("Вс");
    }
}

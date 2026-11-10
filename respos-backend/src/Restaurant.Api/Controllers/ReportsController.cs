using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Authorization;
using Restaurant.Api.Filters;
using Restaurant.Application.Features.Dashboard;
using Restaurant.Application.Features.Reports.CashShifts;
using Restaurant.Application.Features.Reports.Common;
using Restaurant.Application.Features.Reports.Export;
using Restaurant.Application.Features.Reports.Sales;
using Restaurant.Application.Features.Reports.Stock;
using Restaurant.Domain.Constants;

namespace Restaurant.Api.Controllers;

/// <summary>Dashboard + reports (branch-scoped, branch timezone, server-calculated). All require <c>reports.read</c>; export also <c>reports.export</c>.</summary>
[RequireBranch]
[HasPermission(Permissions.Reports.Read)]
public sealed class ReportsController : ApiControllerBase
{
    [HttpGet(RoutePrefix + "dashboard")]
    [ProducesResponseType<DashboardDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Dashboard([FromServices] GetDashboardHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new DashboardQuery(), ct));

    [HttpGet(RoutePrefix + "reports/sales")]
    [ProducesResponseType<SalesReportDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Sales([FromQuery] ReportPeriodQuery query, [FromServices] SalesReportHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(query, ct));

    [HttpGet(RoutePrefix + "reports/top-items")]
    [ProducesResponseType<IReadOnlyList<TopItemDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> TopItems([FromQuery] TopItemsQuery query, [FromServices] TopItemsReportHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(query, ct));

    [HttpGet(RoutePrefix + "reports/sales-by-category")]
    [ProducesResponseType<IReadOnlyList<CategorySalesDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> SalesByCategory(
        [FromQuery] ReportPeriodQuery query, [FromServices] SalesByCategoryReportHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(query, ct));

    [HttpGet(RoutePrefix + "reports/payment-methods")]
    [ProducesResponseType<IReadOnlyList<PaymentMethodTotalDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> PaymentMethods(
        [FromQuery] ReportPeriodQuery query, [FromServices] PaymentMethodsReportHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(query, ct));

    [HttpGet(RoutePrefix + "reports/stock")]
    [ProducesResponseType<IReadOnlyList<StockBalanceReportDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Stock([FromServices] StockReportHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new StockReportQuery(), ct));

    [HttpGet(RoutePrefix + "reports/low-stock")]
    [ProducesResponseType<IReadOnlyList<StockBalanceReportDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> LowStock([FromServices] StockReportHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new StockReportQuery(LowOnly: true), ct));

    [HttpGet(RoutePrefix + "reports/stock-movements")]
    [ProducesResponseType<IReadOnlyList<StockMovementTotalDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> StockMovements(
        [FromQuery] ReportPeriodQuery query, [FromServices] StockMovementsReportHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(query, ct));

    [HttpGet(RoutePrefix + "reports/cash-shifts")]
    [ProducesResponseType<IReadOnlyList<CashShiftReportDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> CashShifts(
        [FromQuery] ReportPeriodQuery query, [FromServices] CashShiftsReportHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(query, ct));

    /// <summary>
    /// Requires <c>reports.export</c> (+ <c>reports.read</c>). <c>format=csv</c> → <c>text/csv</c> (UTF-8 BOM), <c>xlsx</c> → OOXML workbook,
    /// <c>pdf</c> → print-ready HTML (sales-summary, z-report; browser prints to PDF, ADR-0015). Names: see ExportReportHandler.Names.
    /// </summary>
    [HttpGet(RoutePrefix + "reports/{name}/export")]
    [HasPermission(Permissions.Reports.Export)]
    [Produces("text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/html", "application/json")]
    public async Task<IActionResult> Export(
        string name, [FromQuery] ExportReportQuery query, [FromServices] ExportReportHandler handler, CancellationToken ct)
    {
        var result = await handler.HandleAsync(query with { Name = name }, ct);
        if (result.IsFailure)
        {
            return Problem(result.Error);
        }

        if (result.Value.ContentType.StartsWith("text/html", StringComparison.Ordinal))
        {
            Response.Headers.ContentSecurityPolicy = "default-src 'none'; style-src 'unsafe-inline'; img-src data:";
        }

        return File(result.Value.Content, result.Value.ContentType, result.Value.FileName);
    }
}

using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Authorization;
using Restaurant.Api.Filters;
using Restaurant.Application.Common.Models;
using Restaurant.Application.Features.Inventory.Common;
using Restaurant.Application.Features.Inventory.InventoryCounts;
using Restaurant.Application.Features.Inventory.StockMovements;
using Restaurant.Domain.Constants;

namespace Restaurant.Api.Controllers;

/// <summary>Stock movements and inventory counts of the X-Branch-Id branch.</summary>
[Route(RoutePrefix + "stock")]
[RequireBranch]
public sealed class StockController : ApiControllerBase
{
    [HttpGet("movements")]
    [HasPermission(Permissions.Inventory.Read)]
    [ProducesResponseType<PagedResult<StockMovementDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> ListMovements(
        [FromQuery] ListStockMovementsQuery query, [FromServices] ListStockMovementsHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(query, ct));

    [HttpPost("movements")]
    [HasPermission(Permissions.Inventory.Adjust)]
    [ProducesResponseType<StockMovementDto>(StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateMovement(
        [FromBody] CreateStockMovementCommand command, [FromServices] CreateStockMovementHandler handler, CancellationToken ct) =>
        CreatedOrProblem(await handler.HandleAsync(command, ct));

    [HttpGet("counts")]
    [HasPermission(Permissions.Inventory.Read, Permissions.Inventory.Adjust)]
    [ProducesResponseType<PagedResult<InventoryCountSummaryDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> ListCounts(
        [FromQuery] ListInventoryCountsQuery query, [FromServices] ListInventoryCountsHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(query, ct));

    [HttpGet("counts/{id:guid}")]
    [HasPermission(Permissions.Inventory.Read, Permissions.Inventory.Adjust)]
    [ProducesResponseType<InventoryCountDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCount(Guid id, [FromServices] GetInventoryCountHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new GetInventoryCountQuery(id), ct));

    [HttpPost("counts")]
    [HasPermission(Permissions.Inventory.Adjust)]
    [ProducesResponseType<InventoryCountDto>(StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateCount(
        [FromBody] CreateInventoryCountCommand command, [FromServices] CreateInventoryCountHandler handler, CancellationToken ct) =>
        CreatedOrProblem(await handler.HandleAsync(command, ct));

    [HttpPut("counts/{id:guid}")]
    [HasPermission(Permissions.Inventory.Adjust)]
    [ProducesResponseType<InventoryCountDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateCount(
        Guid id, [FromBody] UpdateInventoryCountCommand command, [FromServices] UpdateInventoryCountHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(command with { Id = id }, ct));

    [HttpPost("counts/{id:guid}/complete")]
    [HasPermission(Permissions.Inventory.Adjust)]
    [ProducesResponseType<InventoryCountDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> CompleteCount(Guid id, [FromServices] CompleteInventoryCountHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new CompleteInventoryCountCommand(id), ct));
}

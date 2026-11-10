using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Authorization;
using Restaurant.Api.Filters;
using Restaurant.Application.Common.Models;
using Restaurant.Application.Features.Inventory.Transfers;
using Restaurant.Domain.Constants;

namespace Restaurant.Api.Controllers;

/// <summary>
/// Stock transfers between branches (F4), seen from the X-Branch-Id branch: create/edit/send/cancel from the source,
/// receive from the destination (the user must have access to that branch).
/// </summary>
[Route(RoutePrefix + "stock/transfers")]
[RequireBranch]
public sealed class StockTransfersController : ApiControllerBase
{
    [HttpGet]
    [HasPermission(Permissions.Inventory.Read, Permissions.Inventory.Transfer)]
    [ProducesResponseType<PagedResult<StockTransferDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] ListStockTransfersQuery query, [FromServices] ListStockTransfersHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(query, ct));

    [HttpGet("{id:guid}")]
    [HasPermission(Permissions.Inventory.Read, Permissions.Inventory.Transfer)]
    [ProducesResponseType<StockTransferDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(Guid id, [FromServices] GetStockTransferHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new GetStockTransferQuery(id), ct));

    [HttpPost]
    [HasPermission(Permissions.Inventory.Transfer)]
    [ProducesResponseType<StockTransferDto>(StatusCodes.Status201Created)]
    public async Task<IActionResult> Create(
        [FromBody] SaveStockTransferCommand command, [FromServices] SaveStockTransferHandler handler, CancellationToken ct) =>
        CreatedOrProblem(await handler.HandleAsync(command with { Id = null }, ct));

    [HttpPut("{id:guid}")]
    [HasPermission(Permissions.Inventory.Transfer)]
    [ProducesResponseType<StockTransferDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(
        Guid id, [FromBody] SaveStockTransferCommand command, [FromServices] SaveStockTransferHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(command with { Id = id }, ct));

    [HttpPost("{id:guid}/send")]
    [HasPermission(Permissions.Inventory.Transfer)]
    [ProducesResponseType<StockTransferDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Send(Guid id, [FromServices] SendStockTransferHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new StockTransferActionCommand(id), ct));

    [HttpPost("{id:guid}/receive")]
    [HasPermission(Permissions.Inventory.Transfer)]
    [RequireIdempotencyKey]
    [ProducesResponseType<StockTransferDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Receive(Guid id, [FromServices] ReceiveStockTransferHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new StockTransferActionCommand(id), ct));

    [HttpPost("{id:guid}/cancel")]
    [HasPermission(Permissions.Inventory.Transfer)]
    [ProducesResponseType<StockTransferDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Cancel(Guid id, [FromServices] CancelStockTransferHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new StockTransferActionCommand(id), ct));
}

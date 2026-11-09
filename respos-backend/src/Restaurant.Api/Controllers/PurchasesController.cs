using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Authorization;
using Restaurant.Api.Filters;
using Restaurant.Application.Common.Models;
using Restaurant.Application.Features.Procurement.Purchases;
using Restaurant.Domain.Constants;

namespace Restaurant.Api.Controllers;

/// <summary>Purchase orders of the X-Branch-Id branch.</summary>
[Route(RoutePrefix + "purchases")]
[RequireBranch]
public sealed class PurchasesController : ApiControllerBase
{
    [HttpGet]
    [HasPermission(Permissions.Purchases.Read)]
    [ProducesResponseType<PagedResult<PurchaseDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromQuery] ListPurchasesQuery query, [FromServices] ListPurchasesHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(query, ct));

    [HttpGet("{id:guid}")]
    [HasPermission(Permissions.Purchases.Read)]
    [ProducesResponseType<PurchaseDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(Guid id, [FromServices] GetPurchaseHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new GetPurchaseQuery(id), ct));

    [HttpPost]
    [HasPermission(Permissions.Purchases.Manage)]
    [ProducesResponseType<PurchaseDto>(StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] SavePurchaseCommand command, [FromServices] SavePurchaseHandler handler, CancellationToken ct) =>
        CreatedOrProblem(await handler.HandleAsync(command with { Id = null }, ct));

    [HttpPut("{id:guid}")]
    [HasPermission(Permissions.Purchases.Manage)]
    [ProducesResponseType<PurchaseDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(
        Guid id, [FromBody] SavePurchaseCommand command, [FromServices] SavePurchaseHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(command with { Id = id }, ct));

    [HttpPost("{id:guid}/submit")]
    [HasPermission(Permissions.Purchases.Manage)]
    [ProducesResponseType<PurchaseDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Submit(Guid id, [FromServices] SubmitPurchaseHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new PurchaseActionCommand(id), ct));

    [HttpPost("{id:guid}/cancel")]
    [HasPermission(Permissions.Purchases.Manage)]
    [ProducesResponseType<PurchaseDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Cancel(Guid id, [FromServices] CancelPurchaseHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new PurchaseActionCommand(id), ct));

    [HttpPost("{id:guid}/receive")]
    [HasPermission(Permissions.Purchases.Receive)]
    [RequireIdempotencyKey]
    [ProducesResponseType<PurchaseDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Receive(
        Guid id, [FromBody] ReceivePurchaseCommand command, [FromServices] ReceivePurchaseHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(command with { Id = id }, ct));
}

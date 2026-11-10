using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Authorization;
using Restaurant.Api.Filters;
using Restaurant.Application.Features.Orders.Common;
using Restaurant.Application.Features.Orders.SplitBill;
using Restaurant.Domain.Constants;

namespace Restaurant.Api.Controllers;

/// <summary>F2 split bill: split an order into sub-checks and merge them back (both [orders.split]).</summary>
[Route(RoutePrefix + "orders/{id:guid}/split")]
[RequireBranch]
public sealed class OrderBillsController : ApiControllerBase
{
    [HttpPost]
    [HasPermission(Permissions.Orders.Split)]
    [ProducesResponseType<OrderDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Split(Guid id, [FromBody] SplitOrderCommand command, [FromServices] SplitOrderHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(command with { OrderId = id }, ct));

    [HttpDelete]
    [HasPermission(Permissions.Orders.Split)]
    [ProducesResponseType<OrderDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Merge(Guid id, [FromServices] MergeBillsHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(new MergeBillsCommand(id), ct));
}

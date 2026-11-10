using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Authorization;
using Restaurant.Api.Filters;
using Restaurant.Application.Features.Customers.Common;
using Restaurant.Application.Features.Customers.OrderGuest;
using Restaurant.Application.Features.Orders.Common;
using Restaurant.Domain.Constants;

namespace Restaurant.Api.Controllers;

/// <summary>Guest link and loyalty points on an order of the current branch (F1).</summary>
[Route(RoutePrefix + "orders/{id:guid}")]
[RequireBranch]
public sealed class OrderGuestController : ApiControllerBase
{
    [HttpPost("customer")]
    [HasPermission(Permissions.Customers.Read)]
    [HasPermission(Permissions.Orders.Update, Permissions.Payments.Create)]
    [ProducesResponseType<OrderDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Attach(
        Guid id, [FromBody] AttachCustomerCommand command, [FromServices] AttachCustomerHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(command with { OrderId = id }, ct));

    [HttpDelete("customer")]
    [HasPermission(Permissions.Customers.Read)]
    [HasPermission(Permissions.Orders.Update, Permissions.Payments.Create)]
    [ProducesResponseType<OrderDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Detach(Guid id, [FromServices] DetachCustomerHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new DetachCustomerCommand(id), ct));

    [HttpGet("loyalty")]
    [HasPermission(Permissions.Customers.Read, Permissions.Customers.LoyaltyRedeem)]
    [ProducesResponseType<OrderLoyaltyDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Loyalty(Guid id, [FromServices] GetOrderLoyaltyHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new GetOrderLoyaltyQuery(id), ct));

    [HttpPost("loyalty/redeem")]
    [HasPermission(Permissions.Customers.LoyaltyRedeem)]
    [ProducesResponseType<OrderDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Redeem(
        Guid id, [FromBody] RedeemPointsCommand command, [FromServices] RedeemPointsHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(command with { OrderId = id }, ct));

    [HttpDelete("loyalty/redeem")]
    [HasPermission(Permissions.Customers.LoyaltyRedeem)]
    [ProducesResponseType<OrderDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> CancelRedemption(Guid id, [FromServices] CancelRedemptionHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new CancelRedemptionCommand(id), ct));
}

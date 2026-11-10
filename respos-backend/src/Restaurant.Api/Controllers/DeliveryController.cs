using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Authorization;
using Restaurant.Api.Filters;
using Restaurant.Application.Features.Delivery.Common;
using Restaurant.Application.Features.Delivery.Couriers;
using Restaurant.Application.Features.Delivery.Orders;
using Restaurant.Domain.Constants;

namespace Restaurant.Api.Controllers;

/// <summary>Delivery board, delivery orders and couriers of the current branch (F3).</summary>
[Route(RoutePrefix + "delivery")]
[RequireBranch]
public sealed class DeliveryController : ApiControllerBase
{
    [HttpGet("orders")]
    [HasPermission(Permissions.Delivery.Read)]
    [ProducesResponseType<IReadOnlyList<DeliveryOrderDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromQuery] ListDeliveriesQuery query, [FromServices] ListDeliveriesHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(query, ct));

    [HttpGet("orders/{orderId:guid}")]
    [HasPermission(Permissions.Delivery.Read)]
    [ProducesResponseType<DeliveryOrderDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(Guid orderId, [FromServices] GetDeliveryHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(new GetDeliveryQuery(orderId), ct));

    [HttpPost("orders")]
    [HasPermission(Permissions.Delivery.Manage)]
    [ProducesResponseType<DeliveryOrderDto>(StatusCodes.Status201Created)]
    public async Task<IActionResult> Create(
        [FromBody] CreateDeliveryOrderCommand command, [FromServices] CreateDeliveryOrderHandler h, CancellationToken ct) =>
        CreatedOrProblem(await h.HandleAsync(command, ct));

    [HttpPut("orders/{orderId:guid}")]
    [HasPermission(Permissions.Delivery.Manage)]
    [ProducesResponseType<DeliveryOrderDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(
        Guid orderId, [FromBody] UpdateDeliveryDetailsCommand command, [FromServices] UpdateDeliveryDetailsHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(command with { OrderId = orderId }, ct));

    [HttpPost("orders/{orderId:guid}/status")]
    [HasPermission(Permissions.Delivery.Manage)]
    [ProducesResponseType<DeliveryOrderDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> ChangeStatus(
        Guid orderId, [FromBody] ChangeDeliveryStatusCommand command, [FromServices] ChangeDeliveryStatusHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(command with { OrderId = orderId }, ct));

    [HttpPost("orders/{orderId:guid}/courier")]
    [HasPermission(Permissions.Delivery.Manage)]
    [ProducesResponseType<DeliveryOrderDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> AssignCourier(
        Guid orderId, [FromBody] AssignCourierCommand command, [FromServices] AssignCourierHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(command with { OrderId = orderId }, ct));

    [HttpGet("couriers")]
    [HasPermission(Permissions.Delivery.Read)]
    [ProducesResponseType<IReadOnlyList<CourierDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Couriers([FromQuery] bool includeInactive, [FromServices] ListCouriersHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(new ListCouriersQuery(includeInactive), ct));

    [HttpPost("couriers")]
    [HasPermission(Permissions.Delivery.Manage)]
    [ProducesResponseType<CourierDto>(StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateCourier([FromBody] SaveCourierCommand command, [FromServices] SaveCourierHandler h, CancellationToken ct) =>
        CreatedOrProblem(await h.HandleAsync(command with { Id = Guid.Empty }, ct));

    [HttpPut("couriers/{id:guid}")]
    [HasPermission(Permissions.Delivery.Manage)]
    [ProducesResponseType<CourierDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateCourier(
        Guid id, [FromBody] SaveCourierCommand command, [FromServices] SaveCourierHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(command with { Id = id }, ct));
}

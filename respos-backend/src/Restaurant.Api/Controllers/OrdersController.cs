using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Authorization;
using Restaurant.Api.Filters;
using Restaurant.Application.Common.Models;
using Restaurant.Application.Features.Orders.ApplyDiscount;
using Restaurant.Application.Features.Orders.CancelOrder;
using Restaurant.Application.Features.Orders.Common;
using Restaurant.Application.Features.Orders.CreateOrder;
using Restaurant.Application.Features.Orders.GetOrders;
using Restaurant.Application.Features.Orders.GetReceipt;
using Restaurant.Application.Features.Orders.Items;
using Restaurant.Application.Features.Orders.SendToKitchen;
using Restaurant.Application.Features.Orders.TransferOrder;
using Restaurant.Domain.Constants;

namespace Restaurant.Api.Controllers;

[Route(RoutePrefix + "orders")]
[RequireBranch]
public sealed class OrdersController : ApiControllerBase
{
    [HttpGet]
    [HasPermission(Permissions.Orders.Read)]
    [ProducesResponseType<PagedResult<OrderDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromQuery] ListOrdersQuery query, [FromServices] ListOrdersHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(query, ct));

    [HttpGet("active")]
    [HasPermission(Permissions.Orders.Read)]
    [ProducesResponseType<IReadOnlyList<OrderDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Active([FromServices] ListActiveOrdersHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(new ListActiveOrdersQuery(), ct));

    [HttpGet("{id:guid}")]
    [HasPermission(Permissions.Orders.Read)]
    [ProducesResponseType<OrderDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(Guid id, [FromServices] GetOrderHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(new GetOrderQuery(id), ct));

    [HttpGet("{id:guid}/receipt")]
    [HasPermission(Permissions.Orders.Read, Permissions.Payments.Read)]
    [ProducesResponseType<ReceiptDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Receipt(Guid id, [FromServices] GetReceiptHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(new GetReceiptQuery(id), ct));

    [HttpPost]
    [HasPermission(Permissions.Orders.Create)]
    [ProducesResponseType<OrderDto>(StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] CreateOrderCommand command, [FromServices] CreateOrderHandler h, CancellationToken ct) =>
        CreatedOrProblem(await h.HandleAsync(command, ct));

    [HttpPost("{id:guid}/items")]
    [HasPermission(Permissions.Orders.Update)]
    [ProducesResponseType<OrderDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> AddItems(
        Guid id, [FromBody] AddOrderItemsCommand command, [FromServices] AddOrderItemsHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(command with { OrderId = id }, ct));

    [HttpPut("{id:guid}/items/{itemId:guid}")]
    [HasPermission(Permissions.Orders.Update)]
    [ProducesResponseType<OrderDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateItem(
        Guid id, Guid itemId, [FromBody] UpdateOrderItemCommand command, [FromServices] UpdateOrderItemHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(command with { OrderId = id, ItemId = itemId }, ct));

    /// <summary>New items: orders.update; items already sent to the kitchen: orders.cancel (checked in the handler).</summary>
    [HttpPost("{id:guid}/items/{itemId:guid}/cancel")]
    [HasPermission(Permissions.Orders.Update, Permissions.Orders.Cancel)]
    [ProducesResponseType<OrderDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> CancelItem(
        Guid id, Guid itemId, [FromBody] CancelOrderItemCommand command, [FromServices] CancelOrderItemHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(command with { OrderId = id, ItemId = itemId }, ct));

    [HttpPost("{id:guid}/items/{itemId:guid}/serve")]
    [HasPermission(Permissions.Orders.Update)]
    [ProducesResponseType<OrderDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> ServeItem(Guid id, Guid itemId, [FromServices] ServeOrderItemsHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(new ServeOrderItemsCommand(id, itemId), ct));

    [HttpPost("{id:guid}/serve-all")]
    [HasPermission(Permissions.Orders.Update)]
    [ProducesResponseType<OrderDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> ServeAll(Guid id, [FromServices] ServeOrderItemsHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(new ServeOrderItemsCommand(id, null), ct));

    [HttpPost("{id:guid}/send-to-kitchen")]
    [HasPermission(Permissions.Orders.Update)]
    [RequireIdempotencyKey]
    [ProducesResponseType<OrderDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> SendToKitchen(
        Guid id, [FromBody] SendToKitchenCommand? command, [FromServices] SendToKitchenHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync((command ?? new SendToKitchenCommand(null)) with { OrderId = id }, ct));

    [HttpPost("{id:guid}/discount")]
    [HasPermission(Permissions.Orders.DiscountApply)]
    [ProducesResponseType<OrderDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Discount(
        Guid id, [FromBody] ApplyDiscountCommand command, [FromServices] ApplyDiscountHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(command with { OrderId = id }, ct));

    [HttpPost("{id:guid}/transfer")]
    [HasPermission(Permissions.Orders.Transfer)]
    [ProducesResponseType<OrderDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Transfer(
        Guid id, [FromBody] TransferOrderCommand command, [FromServices] TransferOrderHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(command with { OrderId = id }, ct));

    [HttpPost("{id:guid}/cancel")]
    [HasPermission(Permissions.Orders.Cancel)]
    [ProducesResponseType<OrderDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Cancel(
        Guid id, [FromBody] CancelOrderCommand command, [FromServices] CancelOrderHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(command with { OrderId = id }, ct));
}

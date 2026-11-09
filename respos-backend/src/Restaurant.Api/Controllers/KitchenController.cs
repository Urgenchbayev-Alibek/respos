using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Authorization;
using Restaurant.Api.Filters;
using Restaurant.Application.Features.Kitchen.Common;
using Restaurant.Application.Features.Kitchen.ListTickets;
using Restaurant.Application.Features.Kitchen.UpdateTicketStatus;
using Restaurant.Domain.Constants;

namespace Restaurant.Api.Controllers;

/// <summary>Kitchen Display System: tickets and their progress.</summary>
[Route(RoutePrefix + "kitchen")]
[RequireBranch]
public sealed class KitchenController : ApiControllerBase
{
    [HttpGet("tickets")]
    [HasPermission(Permissions.Kitchen.Read)]
    [ProducesResponseType<IReadOnlyList<KitchenTicketDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Tickets([FromQuery] ListTicketsQuery query, [FromServices] ListTicketsHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(query, ct));

    [HttpPost("tickets/{id:guid}/start")]
    [HasPermission(Permissions.Kitchen.StatusUpdate)]
    [ProducesResponseType<KitchenTicketDto>(StatusCodes.Status200OK)]
    public Task<IActionResult> Start(Guid id, [FromServices] UpdateTicketStatusHandler h, CancellationToken ct) =>
        Ticket(id, TicketAction.Start, h, ct);

    [HttpPost("tickets/{id:guid}/ready")]
    [HasPermission(Permissions.Kitchen.StatusUpdate)]
    [ProducesResponseType<KitchenTicketDto>(StatusCodes.Status200OK)]
    public Task<IActionResult> Ready(Guid id, [FromServices] UpdateTicketStatusHandler h, CancellationToken ct) =>
        Ticket(id, TicketAction.Ready, h, ct);

    [HttpPost("tickets/{id:guid}/served")]
    [HasPermission(Permissions.Kitchen.StatusUpdate)]
    [ProducesResponseType<KitchenTicketDto>(StatusCodes.Status200OK)]
    public Task<IActionResult> Served(Guid id, [FromServices] UpdateTicketStatusHandler h, CancellationToken ct) =>
        Ticket(id, TicketAction.Served, h, ct);

    [HttpPost("tickets/{id:guid}/recall")]
    [HasPermission(Permissions.Kitchen.StatusUpdate)]
    [ProducesResponseType<KitchenTicketDto>(StatusCodes.Status200OK)]
    public Task<IActionResult> Recall(Guid id, [FromServices] UpdateTicketStatusHandler h, CancellationToken ct) =>
        Ticket(id, TicketAction.Recall, h, ct);

    [HttpPost("ticket-items/{id:guid}/start")]
    [HasPermission(Permissions.Kitchen.StatusUpdate)]
    [ProducesResponseType<KitchenTicketDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> StartItem(Guid id, [FromServices] UpdateTicketItemStatusHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(new UpdateTicketItemStatusCommand(id, TicketItemAction.Start), ct));

    [HttpPost("ticket-items/{id:guid}/ready")]
    [HasPermission(Permissions.Kitchen.StatusUpdate)]
    [ProducesResponseType<KitchenTicketDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> ReadyItem(Guid id, [FromServices] UpdateTicketItemStatusHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(new UpdateTicketItemStatusCommand(id, TicketItemAction.Ready), ct));

    private async Task<IActionResult> Ticket(Guid id, TicketAction action, UpdateTicketStatusHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(new UpdateTicketStatusCommand(id, action), ct));
}

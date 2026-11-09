using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Authorization;
using Restaurant.Api.Filters;
using Restaurant.Application.Common.Models;
using Restaurant.Application.Features.Reservations.Common;
using Restaurant.Application.Features.Reservations.ListReservations;
using Restaurant.Application.Features.Reservations.ReservationActions;
using Restaurant.Application.Features.Reservations.SaveReservation;
using Restaurant.Domain.Constants;

namespace Restaurant.Api.Controllers;

[Route(RoutePrefix + "reservations")]
[RequireBranch]
public sealed class ReservationsController : ApiControllerBase
{
    [HttpGet]
    [HasPermission(Permissions.Reservations.Read)]
    [ProducesResponseType<PagedResult<ReservationDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] ListReservationsQuery query, [FromServices] ListReservationsHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(query, ct));

    [HttpPost]
    [HasPermission(Permissions.Reservations.Manage)]
    [ProducesResponseType<ReservationDto>(StatusCodes.Status201Created)]
    public async Task<IActionResult> Create(
        [FromBody] SaveReservationCommand command, [FromServices] SaveReservationHandler handler, CancellationToken ct) =>
        CreatedOrProblem(await handler.HandleAsync(command with { Id = null }, ct));

    [HttpPut("{id:guid}")]
    [HasPermission(Permissions.Reservations.Manage)]
    [ProducesResponseType<ReservationDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(
        Guid id, [FromBody] SaveReservationCommand command, [FromServices] SaveReservationHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(command with { Id = id }, ct));

    [HttpPost("{id:guid}/confirm")]
    [HasPermission(Permissions.Reservations.Manage)]
    [ProducesResponseType<ReservationDto>(StatusCodes.Status200OK)]
    public Task<IActionResult> Confirm(Guid id, [FromServices] ReservationActionHandler handler, CancellationToken ct) =>
        Run(handler, new ReservationActionCommand(id, ReservationAction.Confirm), ct);

    [HttpPost("{id:guid}/seat")]
    [HasPermission(Permissions.Reservations.Manage)]
    [ProducesResponseType<ReservationDto>(StatusCodes.Status200OK)]
    public Task<IActionResult> Seat(Guid id, [FromServices] ReservationActionHandler handler, CancellationToken ct) =>
        Run(handler, new ReservationActionCommand(id, ReservationAction.Seat), ct);

    [HttpPost("{id:guid}/complete")]
    [HasPermission(Permissions.Reservations.Manage)]
    [ProducesResponseType<ReservationDto>(StatusCodes.Status200OK)]
    public Task<IActionResult> Complete(Guid id, [FromServices] ReservationActionHandler handler, CancellationToken ct) =>
        Run(handler, new ReservationActionCommand(id, ReservationAction.Complete), ct);

    [HttpPost("{id:guid}/no-show")]
    [HasPermission(Permissions.Reservations.Manage)]
    [ProducesResponseType<ReservationDto>(StatusCodes.Status200OK)]
    public Task<IActionResult> NoShow(Guid id, [FromServices] ReservationActionHandler handler, CancellationToken ct) =>
        Run(handler, new ReservationActionCommand(id, ReservationAction.NoShow), ct);

    [HttpPost("{id:guid}/cancel")]
    [HasPermission(Permissions.Reservations.Manage)]
    [ProducesResponseType<ReservationDto>(StatusCodes.Status200OK)]
    public Task<IActionResult> Cancel(
        Guid id, [FromBody] CancelReservationRequest? body, [FromServices] ReservationActionHandler handler, CancellationToken ct) =>
        Run(handler, new ReservationActionCommand(id, ReservationAction.Cancel, body?.Reason), ct);

    private async Task<IActionResult> Run(ReservationActionHandler handler, ReservationActionCommand command, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(command, ct));
}

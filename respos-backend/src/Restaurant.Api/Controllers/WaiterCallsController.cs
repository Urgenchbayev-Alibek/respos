using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Authorization;
using Restaurant.Api.Filters;
using Restaurant.Application.Features.PublicMenu.WaiterCalls;
using Restaurant.Domain.Constants;

namespace Restaurant.Api.Controllers;

/// <summary>Guest calls from the QR menu for the waiter workspace.</summary>
[Route(RoutePrefix + "waiter-calls")]
[RequireBranch]
public sealed class WaiterCallsController : ApiControllerBase
{
    [HttpGet]
    [HasPermission(Permissions.Orders.Read)]
    [ProducesResponseType<IReadOnlyList<WaiterCallDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromServices] ListWaiterCallsHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(new ListWaiterCallsQuery(), ct));

    [HttpPost("{id:guid}/acknowledge")]
    [HasPermission(Permissions.Orders.Update)]
    [ProducesResponseType<WaiterCallDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Acknowledge(Guid id, [FromServices] AcknowledgeWaiterCallHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(new AcknowledgeWaiterCallCommand(id), ct));
}

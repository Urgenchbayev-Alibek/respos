using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Authorization;
using Restaurant.Api.Filters;
using Restaurant.Application.Features.Reservations.Availability;
using Restaurant.Domain.Constants;

namespace Restaurant.Api.Controllers;

/// <summary>F7: <c>GET /reservations/availability</c> — free tables per time slot of a branch-local day.</summary>
[Route(RoutePrefix + "reservations/availability")]
[RequireBranch]
public sealed class ReservationAvailabilityController : ApiControllerBase
{
    [HttpGet]
    [HasPermission(Permissions.Reservations.Read)]
    [ProducesResponseType<ReservationAvailabilityDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(
        [FromQuery] ReservationAvailabilityQuery query, [FromServices] ReservationAvailabilityHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(query, ct));
}

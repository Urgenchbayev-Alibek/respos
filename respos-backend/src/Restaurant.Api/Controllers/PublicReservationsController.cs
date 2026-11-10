using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Restaurant.Api.Extensions;
using Restaurant.Application.Features.Public.Reservations;

namespace Restaurant.Api.Controllers;

/// <summary>
/// F7: anonymous online reservations for the landing page, keyed by branch id for now
/// (the orchestrator switches the route to the branch slug once <c>Branch.Slug</c> exists).
/// </summary>
[AllowAnonymous]
[Route(RoutePrefix + "public/branches/{branchId:guid}")]
public sealed class PublicReservationsController : ApiControllerBase
{
    [HttpGet("availability")]
    [EnableRateLimiting(PublicReservationRateLimits.AvailabilityPolicy)]
    [ProducesResponseType<PublicAvailabilityDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Availability(
        Guid branchId, [FromQuery] PublicAvailabilityQuery query, [FromServices] PublicAvailabilityHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(query with { BranchId = branchId }, ct));

    [HttpPost("reservations")]
    [EnableRateLimiting(PublicReservationRateLimits.CreatePolicy)]
    [ProducesResponseType<PublicReservationCreatedDto>(StatusCodes.Status201Created)]
    public async Task<IActionResult> Create(
        Guid branchId, [FromBody] CreatePublicReservationCommand command, [FromServices] CreatePublicReservationHandler handler, CancellationToken ct) =>
        CreatedOrProblem(await handler.HandleAsync(command with { BranchId = branchId }, ct));
}

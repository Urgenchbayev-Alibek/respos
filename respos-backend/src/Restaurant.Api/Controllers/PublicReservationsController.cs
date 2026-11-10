using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Restaurant.Api.Extensions;
using Restaurant.Application.Features.Public.Reservations;

namespace Restaurant.Api.Controllers;

/// <summary>
/// F7: anonymous online reservations for the landing page, keyed by the public branch slug (F3 <c>Branch.Slug</c>,
/// same as the QR menu). Unknown/inactive branch or suspended organization → 404 <c>branch.not_found</c>.
/// </summary>
[AllowAnonymous]
[Route(RoutePrefix + "public/branches/{branchSlug}")]
public sealed class PublicReservationsController : ApiControllerBase
{
    [HttpGet("availability")]
    [EnableRateLimiting(PublicReservationRateLimits.AvailabilityPolicy)]
    [ProducesResponseType<PublicAvailabilityDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Availability(
        string branchSlug, [FromQuery] PublicAvailabilityQuery query, [FromServices] PublicAvailabilityHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(query with { BranchSlug = branchSlug }, ct));

    [HttpPost("reservations")]
    [EnableRateLimiting(PublicReservationRateLimits.CreatePolicy)]
    [ProducesResponseType<PublicReservationCreatedDto>(StatusCodes.Status201Created)]
    public async Task<IActionResult> Create(
        string branchSlug, [FromBody] CreatePublicReservationCommand command, [FromServices] CreatePublicReservationHandler handler, CancellationToken ct) =>
        CreatedOrProblem(await handler.HandleAsync(command with { BranchSlug = branchSlug }, ct));
}

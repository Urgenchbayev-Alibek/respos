using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Restaurant.Api.Extensions;
using Restaurant.Application.Features.Public.CreateDemoRequest;
using Restaurant.Application.Features.Public.ListPublicPlans;

namespace Restaurant.Api.Controllers;

/// <summary>Anonymous endpoints for the landing page.</summary>
[AllowAnonymous]
[Route(RoutePrefix + "public")]
public sealed class PublicController : ApiControllerBase
{
    [HttpPost("demo-requests")]
    [EnableRateLimiting(RateLimitingExtensions.PublicDemoPolicy)]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    public async Task<IActionResult> CreateDemoRequest(
        [FromBody] CreateDemoRequestCommand command, [FromServices] CreateDemoRequestHandler handler, CancellationToken ct) =>
        AcceptedOrProblem(await handler.HandleAsync(command, ct));

    [HttpGet("plans")]
    [ProducesResponseType<IReadOnlyList<PublicPlanDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Plans([FromServices] ListPublicPlansHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new ListPublicPlansQuery(), ct));
}

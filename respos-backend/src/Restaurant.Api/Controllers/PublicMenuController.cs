using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Net.Http.Headers;
using Restaurant.Api.Filters;
using Restaurant.Application.Features.PublicMenu.Menu;
using Restaurant.Application.Features.PublicMenu.WaiterCalls;

namespace Restaurant.Api.Controllers;

/// <summary>Anonymous QR menu of a branch (landing <c>/menu/:branchSlug</c>).</summary>
[AllowAnonymous]
[Route(RoutePrefix + "public/menu/{branchSlug}")]
public sealed class PublicMenuController : ApiControllerBase
{
    private const int MaxAgeSeconds = 60;

    /// <summary>Menu with <c>ETag</c> + <c>Cache-Control: public, max-age=60</c>; <c>If-None-Match</c> → 304.</summary>
    [HttpGet]
    [ProducesResponseType<PublicMenuDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status304NotModified)]
    public async Task<IActionResult> Get(string branchSlug, [FromServices] GetPublicMenuHandler h, CancellationToken ct)
    {
        var result = await h.HandleAsync(new GetPublicMenuQuery(branchSlug), ct);
        if (result.IsFailure)
        {
            return Problem(result.Error);
        }

        Response.Headers[HeaderNames.ETag] = result.Value.ETag;
        Response.Headers[HeaderNames.CacheControl] = $"public, max-age={MaxAgeSeconds}";
        var ifNoneMatch = Request.Headers[HeaderNames.IfNoneMatch].ToString();
        if (ifNoneMatch.Split(',', StringSplitOptions.TrimEntries).Contains(result.Value.ETag))
        {
            return StatusCode(StatusCodes.Status304NotModified);
        }

        return Ok(result.Value.Menu);
    }

    [HttpPost("call-waiter")]
    [CallWaiterRateLimit]
    [ProducesResponseType<PublicWaiterCallDto>(StatusCodes.Status202Accepted)]
    public async Task<IActionResult> CallWaiter(
        string branchSlug, [FromBody] CallWaiterCommand command, [FromServices] CallWaiterHandler h, CancellationToken ct)
    {
        var result = await h.HandleAsync(command with { BranchSlug = branchSlug }, ct);
        return result.IsSuccess ? StatusCode(StatusCodes.Status202Accepted, result.Value) : Problem(result.Error);
    }
}

using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Authorization;
using Restaurant.Api.Filters;
using Restaurant.Application.Common.Models;
using Restaurant.Application.Features.Integrations.Common;
using Restaurant.Application.Features.Integrations.Outbound;
using Restaurant.Domain.Constants;

namespace Restaurant.Api.Controllers;

/// <summary>F7: Platform → integration errors across all organizations (messages only, no secrets / payloads).</summary>
[PlatformScope]
[Route(RoutePrefix + "platform/integration-errors")]
public sealed class PlatformIntegrationErrorsController : ApiControllerBase
{
    [HttpGet]
    [HasPermission(Permissions.Platform.SystemRead)]
    [ProducesResponseType<PagedResult<IntegrationErrorDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] ListIntegrationErrorsQuery query, [FromServices] ListIntegrationErrorsHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(query with { PlatformScope = true }, ct));
}

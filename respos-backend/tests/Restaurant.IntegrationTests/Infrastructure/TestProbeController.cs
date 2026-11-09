using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Authorization;
using Restaurant.Api.Controllers;
using Restaurant.Api.Filters;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Domain.Constants;

namespace Restaurant.IntegrationTests.Infrastructure;

/// <summary>Test-only endpoints (registered via AddApplicationPart) exercising [RequireBranch] and [RequireIdempotencyKey].</summary>
[Route(RoutePrefix + "test-probe")]
public sealed class TestProbeController(ITenantContext tenant) : ApiControllerBase
{
    public sealed record ProbeRequest(string Value);

    [HttpGet("branch")]
    [RequireBranch]
    [HasPermission(Permissions.Menu.Read)]
    public IActionResult Branch() => Ok(new { branchId = tenant.RequireBranchId() });

    [HttpPost("idempotent")]
    [RequireBranch]
    [RequireIdempotencyKey]
    [HasPermission(Permissions.Menu.Read)]
    public IActionResult Idempotent([FromBody] ProbeRequest request) =>
        StatusCode(StatusCodes.Status201Created, new { id = Guid.NewGuid(), request.Value, branchId = tenant.RequireBranchId() });
}

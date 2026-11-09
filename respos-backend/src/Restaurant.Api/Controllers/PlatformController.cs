using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Authorization;
using Restaurant.Application.Common.Models;
using Restaurant.Application.Features.Audit;
using Restaurant.Application.Features.Platform.DemoRequests;
using Restaurant.Application.Features.Platform.FeatureFlags;
using Restaurant.Application.Features.Platform.Plans;
using Restaurant.Application.Features.Platform.SystemInfo;
using Restaurant.Domain.Constants;

namespace Restaurant.Api.Controllers;

/// <summary>Platform super admin: plans, features, feature flags, system info/events, demo requests.</summary>
[Route(RoutePrefix + "platform")]
public sealed class PlatformController : ApiControllerBase
{
    [HttpGet("plans")]
    [HasPermission(Permissions.Platform.PlansManage, Permissions.Platform.OrganizationsRead)]
    [ProducesResponseType<IReadOnlyList<PlanDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Plans([FromServices] ListPlansHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new ListPlansQuery(), ct));

    [HttpPost("plans")]
    [HasPermission(Permissions.Platform.PlansManage)]
    [ProducesResponseType<PlanDto>(StatusCodes.Status201Created)]
    public async Task<IActionResult> CreatePlan([FromBody] CreatePlanCommand command, [FromServices] CreatePlanHandler handler, CancellationToken ct) =>
        CreatedOrProblem(await handler.HandleAsync(command, ct));

    [HttpPut("plans/{id:guid}")]
    [HasPermission(Permissions.Platform.PlansManage)]
    [ProducesResponseType<PlanDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdatePlan(
        Guid id, [FromBody] UpdatePlanCommand command, [FromServices] UpdatePlanHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(command with { Id = id }, ct));

    [HttpGet("features")]
    [HasPermission(Permissions.Platform.PlansManage, Permissions.Platform.FeatureFlagsManage)]
    [ProducesResponseType<IReadOnlyList<FeatureDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Features([FromServices] ListFeaturesHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new ListFeaturesQuery(), ct));

    [HttpGet("feature-flags")]
    [HasPermission(Permissions.Platform.FeatureFlagsManage)]
    [ProducesResponseType<IReadOnlyList<FeatureFlagDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> FeatureFlags(Guid? organizationId, [FromServices] ListFeatureFlagsHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new ListFeatureFlagsQuery(organizationId), ct));

    [HttpPut("feature-flags")]
    [HasPermission(Permissions.Platform.FeatureFlagsManage)]
    [ProducesResponseType<FeatureFlagDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> SetFeatureFlag(
        [FromBody] SetFeatureFlagCommand command, [FromServices] SetFeatureFlagHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(command, ct));

    [HttpGet("system")]
    [HasPermission(Permissions.Platform.SystemRead)]
    [ProducesResponseType<SystemInfoDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> System(
        [FromServices] IWebHostEnvironment environment, [FromServices] GetSystemInfoHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new GetSystemInfoQuery(environment.EnvironmentName), ct));

    [HttpGet("system-events")]
    [HasPermission(Permissions.Platform.SystemRead)]
    [ProducesResponseType<PagedResult<AuditLogDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> SystemEvents(
        [FromQuery] ListSystemEventsQuery query, [FromServices] ListSystemEventsHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(query, ct));

    [HttpGet("demo-requests")]
    [HasPermission(Permissions.Platform.DemoRequestsRead)]
    [ProducesResponseType<PagedResult<DemoRequestDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> DemoRequests(
        [FromQuery] ListDemoRequestsQuery query, [FromServices] ListDemoRequestsHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(query, ct));

    [HttpPost("demo-requests/{id:guid}/status")]
    [HasPermission(Permissions.Platform.DemoRequestsRead)]
    [ProducesResponseType<DemoRequestDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> ChangeDemoRequestStatus(
        Guid id, [FromBody] ChangeDemoRequestStatusCommand command, [FromServices] ChangeDemoRequestStatusHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(command with { Id = id }, ct));
}

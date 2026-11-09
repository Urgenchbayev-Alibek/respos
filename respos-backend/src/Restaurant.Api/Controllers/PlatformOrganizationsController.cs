using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Authorization;
using Restaurant.Application.Common.Models;
using Restaurant.Application.Features.Platform.Common;
using Restaurant.Application.Features.Platform.Organizations;
using Restaurant.Domain.Constants;

namespace Restaurant.Api.Controllers;

/// <summary>Platform super admin: tenants (aggregates only) + break-glass access. Platform permissions require IsPlatformAdmin.</summary>
[Route(RoutePrefix + "platform/organizations")]
public sealed class PlatformOrganizationsController : ApiControllerBase
{
    [HttpGet]
    [HasPermission(Permissions.Platform.OrganizationsRead)]
    [ProducesResponseType<PagedResult<PlatformOrganizationDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] ListPlatformOrganizationsQuery query, [FromServices] ListPlatformOrganizationsHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(query, ct));

    [HttpPost]
    [HasPermission(Permissions.Platform.OrganizationsManage)]
    [ProducesResponseType<PlatformOrganizationDto>(StatusCodes.Status201Created)]
    public async Task<IActionResult> Create(
        [FromBody] CreatePlatformOrganizationCommand command, [FromServices] CreatePlatformOrganizationHandler handler, CancellationToken ct) =>
        CreatedOrProblem(await handler.HandleAsync(command, ct));

    [HttpPost("{id:guid}/suspend")]
    [HasPermission(Permissions.Platform.OrganizationsManage)]
    [ProducesResponseType<PlatformOrganizationDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Suspend(Guid id, [FromServices] ChangeOrganizationStatusHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new ChangeOrganizationStatusCommand(id, Activate: false), ct));

    [HttpPost("{id:guid}/activate")]
    [HasPermission(Permissions.Platform.OrganizationsManage)]
    [ProducesResponseType<PlatformOrganizationDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Activate(Guid id, [FromServices] ChangeOrganizationStatusHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new ChangeOrganizationStatusCommand(id, Activate: true), ct));

    [HttpPut("{id:guid}/subscription")]
    [HasPermission(Permissions.Platform.OrganizationsManage)]
    [ProducesResponseType<PlatformOrganizationDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateSubscription(
        Guid id, [FromBody] UpdateSubscriptionCommand command, [FromServices] UpdateSubscriptionHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(command with { OrganizationId = id }, ct));

    /// <summary>Break-glass: audited, 30-minute read-only token for the organization. Reason is mandatory.</summary>
    [HttpPost("{id:guid}/access")]
    [HasPermission(Permissions.Platform.TenantDataAccess)]
    [ProducesResponseType<TenantAccessDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Access(
        Guid id, [FromBody] GrantTenantAccessCommand command, [FromServices] GrantTenantAccessHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(command with { OrganizationId = id }, ct));
}

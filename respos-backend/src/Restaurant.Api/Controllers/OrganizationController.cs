using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Authorization;
using Restaurant.Application.Features.Organizations.Common;
using Restaurant.Application.Features.Organizations.GetOrganization;
using Restaurant.Application.Features.Organizations.UpdateOrganization;
using Restaurant.Domain.Constants;

namespace Restaurant.Api.Controllers;

[Route(RoutePrefix + "organization")]
public sealed class OrganizationController : ApiControllerBase
{
    /// <summary>Current organization (any authenticated member).</summary>
    [HttpGet]
    [ProducesResponseType<OrganizationDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Get([FromServices] GetOrganizationHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new GetOrganizationQuery(), ct));

    [HttpPut]
    [HasPermission(Permissions.Settings.Manage)]
    [ProducesResponseType<OrganizationDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(
        [FromBody] UpdateOrganizationCommand command, [FromServices] UpdateOrganizationHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(command, ct));
}

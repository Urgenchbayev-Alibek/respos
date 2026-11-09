using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Authorization;
using Restaurant.Application.Features.Roles.Common;
using Restaurant.Application.Features.Roles.CreateRole;
using Restaurant.Application.Features.Roles.DeleteRole;
using Restaurant.Application.Features.Roles.ListRoles;
using Restaurant.Application.Features.Roles.UpdateRole;
using Restaurant.Domain.Constants;

namespace Restaurant.Api.Controllers;

[Route(RoutePrefix + "roles")]
public sealed class RolesController : ApiControllerBase
{
    [HttpGet]
    [HasPermission(Permissions.Roles.Read)]
    [ProducesResponseType<IReadOnlyList<RoleDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromServices] ListRolesHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new ListRolesQuery(), ct));

    [HttpPost]
    [HasPermission(Permissions.Roles.Manage)]
    [ProducesResponseType<RoleDto>(StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] CreateRoleCommand command, [FromServices] CreateRoleHandler handler, CancellationToken ct) =>
        CreatedOrProblem(await handler.HandleAsync(command, ct));

    [HttpPut("{id:guid}")]
    [HasPermission(Permissions.Roles.Manage)]
    [ProducesResponseType<RoleDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(
        Guid id, [FromBody] UpdateRoleCommand command, [FromServices] UpdateRoleHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(command with { Id = id }, ct));

    [HttpDelete("{id:guid}")]
    [HasPermission(Permissions.Roles.Manage)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(Guid id, [FromServices] DeleteRoleHandler handler, CancellationToken ct) =>
        NoContentOrProblem(await handler.HandleAsync(new DeleteRoleCommand(id), ct));
}

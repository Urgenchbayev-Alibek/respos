using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Authorization;
using Restaurant.Application.Features.Roles.Common;
using Restaurant.Application.Features.Roles.ListRoles;
using Restaurant.Domain.Constants;

namespace Restaurant.Api.Controllers;

[Route(RoutePrefix + "permissions")]
public sealed class PermissionsController : ApiControllerBase
{
    [HttpGet]
    [HasPermission(Permissions.Roles.Read)]
    [ProducesResponseType<IReadOnlyList<PermissionDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromServices] ListPermissionsHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new ListPermissionsQuery(), ct));
}

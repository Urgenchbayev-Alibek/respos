using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Authorization;
using Restaurant.Api.Filters;
using Restaurant.Application.Features.Menu.BranchOverrides;
using Restaurant.Domain.Constants;

namespace Restaurant.Api.Controllers;

/// <summary>Per-branch menu overrides (F4): price / variant prices / availability / kitchen station per branch.</summary>
[Route(RoutePrefix + "menu")]
public sealed class BranchMenuController : ApiControllerBase
{
    [HttpGet("items/{id:guid}/branches")]
    [HasPermission(Permissions.Menu.Read)]
    [ProducesResponseType<IReadOnlyList<BranchMenuItemDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List(Guid id, [FromServices] GetBranchMenuItemsHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new GetBranchMenuItemsQuery(id), ct));

    [HttpPut("items/{id:guid}/branches/{branchId:guid}")]
    [HasPermission(Permissions.Menu.Manage)]
    [ProducesResponseType<BranchMenuItemDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Save(
        Guid id, Guid branchId, [FromBody] SaveBranchMenuItemCommand command, [FromServices] SaveBranchMenuItemHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(command with { MenuItemId = id, BranchId = branchId }, ct));

    [HttpDelete("items/{id:guid}/branches/{branchId:guid}")]
    [HasPermission(Permissions.Menu.Manage)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Reset(Guid id, Guid branchId, [FromServices] ResetBranchMenuItemHandler handler, CancellationToken ct) =>
        NoContentOrProblem(await handler.HandleAsync(new ResetBranchMenuItemCommand(id, branchId), ct));

    /// <summary>Stop-list toggle for the current branch (manager or kitchen).</summary>
    [HttpPut("branch-availability/{menuItemId:guid}")]
    [RequireBranch]
    [HasPermission(Permissions.Menu.Manage, Permissions.Kitchen.StatusUpdate)]
    [ProducesResponseType<BranchMenuItemDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> SetAvailability(
        Guid menuItemId, [FromBody] SetBranchAvailabilityCommand command, [FromServices] SetBranchAvailabilityHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(command with { MenuItemId = menuItemId }, ct));
}

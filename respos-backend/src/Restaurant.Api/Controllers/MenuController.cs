using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Authorization;
using Restaurant.Api.Filters;
using Restaurant.Application.Features.Menu.Categories;
using Restaurant.Application.Features.Menu.Common;
using Restaurant.Application.Features.Menu.ModifierGroups;
using Restaurant.Application.Features.Menu.Pos;
using Restaurant.Domain.Constants;

namespace Restaurant.Api.Controllers;

/// <summary>Menu (org-scoped): categories, modifier groups, POS menu. Items live in <see cref="MenuItemsController"/>.</summary>
[Route(RoutePrefix + "menu")]
public sealed class MenuController : ApiControllerBase
{
    [HttpGet("categories")]
    [HasPermission(Permissions.Menu.Read)]
    [ProducesResponseType<IReadOnlyList<MenuCategoryDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> ListCategories(
        [FromQuery] ListMenuCategoriesQuery query, [FromServices] ListMenuCategoriesHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(query, ct));

    [HttpPost("categories")]
    [HasPermission(Permissions.Menu.Manage)]
    [ProducesResponseType<MenuCategoryDto>(StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateCategory(
        [FromBody] SaveMenuCategoryCommand command, [FromServices] SaveMenuCategoryHandler handler, CancellationToken ct) =>
        CreatedOrProblem(await handler.HandleAsync(command with { Id = null }, ct));

    [HttpPut("categories/reorder")]
    [HasPermission(Permissions.Menu.Manage)]
    [ProducesResponseType<IReadOnlyList<MenuCategoryDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> ReorderCategories(
        [FromBody] ReorderMenuCategoriesCommand command, [FromServices] ReorderMenuCategoriesHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(command, ct));

    [HttpPut("categories/{id:guid}")]
    [HasPermission(Permissions.Menu.Manage)]
    [ProducesResponseType<MenuCategoryDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateCategory(
        Guid id, [FromBody] SaveMenuCategoryCommand command, [FromServices] SaveMenuCategoryHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(command with { Id = id }, ct));

    [HttpDelete("categories/{id:guid}")]
    [HasPermission(Permissions.Menu.Manage)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> ArchiveCategory(Guid id, [FromServices] ArchiveMenuCategoryHandler handler, CancellationToken ct) =>
        NoContentOrProblem(await handler.HandleAsync(new ArchiveMenuCategoryCommand(id), ct));

    [HttpGet("modifier-groups")]
    [HasPermission(Permissions.Menu.Read)]
    [ProducesResponseType<IReadOnlyList<ModifierGroupDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> ListModifierGroups([FromServices] ListModifierGroupsHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new ListModifierGroupsQuery(), ct));

    [HttpPost("modifier-groups")]
    [HasPermission(Permissions.Menu.Manage)]
    [ProducesResponseType<ModifierGroupDto>(StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateModifierGroup(
        [FromBody] SaveModifierGroupCommand command, [FromServices] SaveModifierGroupHandler handler, CancellationToken ct) =>
        CreatedOrProblem(await handler.HandleAsync(command with { Id = null }, ct));

    [HttpPut("modifier-groups/{id:guid}")]
    [HasPermission(Permissions.Menu.Manage)]
    [ProducesResponseType<ModifierGroupDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateModifierGroup(
        Guid id, [FromBody] SaveModifierGroupCommand command, [FromServices] SaveModifierGroupHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(command with { Id = id }, ct));

    [HttpDelete("modifier-groups/{id:guid}")]
    [HasPermission(Permissions.Menu.Manage)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DeleteModifierGroup(Guid id, [FromServices] DeleteModifierGroupHandler handler, CancellationToken ct) =>
        NoContentOrProblem(await handler.HandleAsync(new DeleteModifierGroupCommand(id), ct));

    [HttpGet("pos")]
    [RequireBranch]
    [HasPermission(Permissions.Menu.Read)]
    [ProducesResponseType<IReadOnlyList<PosCategoryDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Pos([FromServices] GetPosMenuHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new GetPosMenuQuery(), ct));
}

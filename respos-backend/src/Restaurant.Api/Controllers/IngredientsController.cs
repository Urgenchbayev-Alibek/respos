using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Authorization;
using Restaurant.Api.Filters;
using Restaurant.Application.Common.Models;
using Restaurant.Application.Features.Inventory.Common;
using Restaurant.Application.Features.Inventory.IngredientCategories;
using Restaurant.Application.Features.Inventory.Ingredients;
using Restaurant.Domain.Constants;

namespace Restaurant.Api.Controllers;

/// <summary>Ingredient categories and ingredients (quantities/minimums for the X-Branch-Id branch).</summary>
[Route(RoutePrefix)]
[RequireBranch]
public sealed class IngredientsController : ApiControllerBase
{
    [HttpGet("ingredient-categories")]
    [HasPermission(Permissions.Inventory.Read)]
    [ProducesResponseType<IReadOnlyList<IngredientCategoryDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> ListCategories(
        [FromQuery] bool includeArchived, [FromServices] ListIngredientCategoriesHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new ListIngredientCategoriesQuery(includeArchived), ct));

    [HttpPost("ingredient-categories")]
    [HasPermission(Permissions.Inventory.Manage)]
    [ProducesResponseType<IngredientCategoryDto>(StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateCategory(
        [FromBody] SaveIngredientCategoryCommand command, [FromServices] SaveIngredientCategoryHandler handler, CancellationToken ct) =>
        CreatedOrProblem(await handler.HandleAsync(command with { Id = null }, ct));

    [HttpPut("ingredient-categories/{id:guid}")]
    [HasPermission(Permissions.Inventory.Manage)]
    [ProducesResponseType<IngredientCategoryDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateCategory(
        Guid id, [FromBody] SaveIngredientCategoryCommand command, [FromServices] SaveIngredientCategoryHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(command with { Id = id }, ct));

    [HttpDelete("ingredient-categories/{id:guid}")]
    [HasPermission(Permissions.Inventory.Manage)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DeleteCategory(Guid id, [FromServices] DeleteIngredientCategoryHandler handler, CancellationToken ct) =>
        NoContentOrProblem(await handler.HandleAsync(new DeleteIngredientCategoryCommand(id), ct));

    [HttpGet("ingredients")]
    [HasPermission(Permissions.Inventory.Read)]
    [ProducesResponseType<PagedResult<IngredientDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromQuery] ListIngredientsQuery query, [FromServices] ListIngredientsHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(query, ct));

    [HttpPost("ingredients")]
    [HasPermission(Permissions.Inventory.Manage)]
    [ProducesResponseType<IngredientDto>(StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] SaveIngredientCommand command, [FromServices] SaveIngredientHandler handler, CancellationToken ct) =>
        CreatedOrProblem(await handler.HandleAsync(command with { Id = null }, ct));

    [HttpPut("ingredients/{id:guid}")]
    [HasPermission(Permissions.Inventory.Manage)]
    [ProducesResponseType<IngredientDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(
        Guid id, [FromBody] SaveIngredientCommand command, [FromServices] SaveIngredientHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(command with { Id = id }, ct));

    [HttpPost("ingredients/{id:guid}/archive")]
    [HasPermission(Permissions.Inventory.Manage)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Archive(Guid id, [FromServices] ArchiveIngredientHandler handler, CancellationToken ct) =>
        NoContentOrProblem(await handler.HandleAsync(new ArchiveIngredientCommand(id), ct));

    [HttpPut("ingredients/{id:guid}/min-quantity")]
    [HasPermission(Permissions.Inventory.Manage)]
    [ProducesResponseType<IngredientDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> SetMinQuantity(
        Guid id, [FromBody] SetMinQuantityCommand command, [FromServices] SetMinQuantityHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(command with { IngredientId = id }, ct));
}

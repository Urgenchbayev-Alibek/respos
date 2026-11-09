using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Authorization;
using Restaurant.Application.Features.Recipes;
using Restaurant.Application.Features.Recipes.Common;
using Restaurant.Domain.Constants;

namespace Restaurant.Api.Controllers;

/// <summary>Org-level versioned recipes.</summary>
[Route(RoutePrefix + "recipes")]
public sealed class RecipesController : ApiControllerBase
{
    [HttpGet]
    [HasPermission(Permissions.Recipes.Read)]
    [ProducesResponseType<IReadOnlyList<RecipeDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromQuery] Guid? menuItemId, [FromServices] ListRecipesHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new ListRecipesQuery(menuItemId), ct));

    [HttpGet("history")]
    [HasPermission(Permissions.Recipes.Read)]
    [ProducesResponseType<IReadOnlyList<RecipeDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> History([FromQuery] RecipeHistoryQuery query, [FromServices] RecipeHistoryHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(query, ct));

    [HttpGet("{id:guid}")]
    [HasPermission(Permissions.Recipes.Read)]
    [ProducesResponseType<RecipeDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(Guid id, [FromServices] GetRecipeHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new GetRecipeQuery(id), ct));

    [HttpPost]
    [HasPermission(Permissions.Recipes.Manage)]
    [ProducesResponseType<RecipeDto>(StatusCodes.Status201Created)]
    public async Task<IActionResult> Save([FromBody] SaveRecipeCommand command, [FromServices] SaveRecipeHandler handler, CancellationToken ct) =>
        CreatedOrProblem(await handler.HandleAsync(command, ct));
}

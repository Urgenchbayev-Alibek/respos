using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Authorization;
using Restaurant.Application.Features.Inventory.Common;
using Restaurant.Application.Features.Inventory.Units;
using Restaurant.Domain.Constants;

namespace Restaurant.Api.Controllers;

/// <summary>Org-level units of measure and conversions (no X-Branch-Id).</summary>
[Route(RoutePrefix)]
public sealed class UnitsController : ApiControllerBase
{
    [HttpGet("units")]
    [HasPermission(Permissions.Inventory.Read)]
    [ProducesResponseType<IReadOnlyList<UnitDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromServices] ListUnitsHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new ListUnitsQuery(), ct));

    [HttpPost("units")]
    [HasPermission(Permissions.Inventory.Manage)]
    [ProducesResponseType<UnitDto>(StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] CreateUnitCommand command, [FromServices] CreateUnitHandler handler, CancellationToken ct) =>
        CreatedOrProblem(await handler.HandleAsync(command, ct));

    [HttpGet("unit-conversions")]
    [HasPermission(Permissions.Inventory.Read)]
    [ProducesResponseType<IReadOnlyList<UnitConversionDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> ListConversions([FromServices] ListUnitConversionsHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new ListUnitConversionsQuery(), ct));

    [HttpPost("unit-conversions")]
    [HasPermission(Permissions.Inventory.Manage)]
    [ProducesResponseType<UnitConversionDto>(StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateConversion(
        [FromBody] CreateUnitConversionCommand command, [FromServices] CreateUnitConversionHandler handler, CancellationToken ct) =>
        CreatedOrProblem(await handler.HandleAsync(command, ct));
}

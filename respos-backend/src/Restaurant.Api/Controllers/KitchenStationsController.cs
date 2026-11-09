using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Authorization;
using Restaurant.Api.Filters;
using Restaurant.Application.Features.KitchenStations;
using Restaurant.Domain.Constants;

namespace Restaurant.Api.Controllers;

[Route(RoutePrefix + "kitchen-stations")]
[RequireBranch]
public sealed class KitchenStationsController : ApiControllerBase
{
    [HttpGet]
    [HasPermission(Permissions.Kitchen.Read)]
    [ProducesResponseType<IReadOnlyList<KitchenStationDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromServices] ListKitchenStationsHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new ListKitchenStationsQuery(), ct));

    [HttpPost]
    [HasPermission(Permissions.Kitchen.StationsManage)]
    [ProducesResponseType<KitchenStationDto>(StatusCodes.Status201Created)]
    public async Task<IActionResult> Create(
        [FromBody] SaveKitchenStationCommand command, [FromServices] SaveKitchenStationHandler handler, CancellationToken ct) =>
        CreatedOrProblem(await handler.HandleAsync(command with { Id = null }, ct));

    [HttpPut("{id:guid}")]
    [HasPermission(Permissions.Kitchen.StationsManage)]
    [ProducesResponseType<KitchenStationDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(
        Guid id, [FromBody] SaveKitchenStationCommand command, [FromServices] SaveKitchenStationHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(command with { Id = id }, ct));

    [HttpDelete("{id:guid}")]
    [HasPermission(Permissions.Kitchen.StationsManage)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Archive(Guid id, [FromServices] ArchiveKitchenStationHandler handler, CancellationToken ct) =>
        NoContentOrProblem(await handler.HandleAsync(new ArchiveKitchenStationCommand(id), ct));
}

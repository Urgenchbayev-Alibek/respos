using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Authorization;
using Restaurant.Api.Filters;
using Restaurant.Application.Features.Floor.Common;
using Restaurant.Application.Features.Floor.DiningAreas;
using Restaurant.Application.Features.Floor.Tables;
using Restaurant.Domain.Constants;

namespace Restaurant.Api.Controllers;

/// <summary>Floor (B): dining areas and tables of the current branch.</summary>
[Route(RoutePrefix)]
[RequireBranch]
public sealed class FloorController : ApiControllerBase
{
    [HttpGet("dining-areas")]
    [HasPermission(Permissions.Tables.Read)]
    [ProducesResponseType<IReadOnlyList<DiningAreaDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> ListAreas([FromServices] ListDiningAreasHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new ListDiningAreasQuery(), ct));

    [HttpPost("dining-areas")]
    [HasPermission(Permissions.Tables.Manage)]
    [ProducesResponseType<DiningAreaDto>(StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateArea(
        [FromBody] SaveDiningAreaCommand command, [FromServices] SaveDiningAreaHandler handler, CancellationToken ct) =>
        CreatedOrProblem(await handler.HandleAsync(command with { Id = null }, ct));

    [HttpPut("dining-areas/{id:guid}")]
    [HasPermission(Permissions.Tables.Manage)]
    [ProducesResponseType<DiningAreaDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateArea(
        Guid id, [FromBody] SaveDiningAreaCommand command, [FromServices] SaveDiningAreaHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(command with { Id = id }, ct));

    [HttpDelete("dining-areas/{id:guid}")]
    [HasPermission(Permissions.Tables.Manage)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> ArchiveArea(Guid id, [FromServices] ArchiveDiningAreaHandler handler, CancellationToken ct) =>
        NoContentOrProblem(await handler.HandleAsync(new ArchiveDiningAreaCommand(id), ct));

    [HttpGet("tables")]
    [HasPermission(Permissions.Tables.Read)]
    [ProducesResponseType<IReadOnlyList<TableDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> ListTables([FromQuery] ListTablesQuery query, [FromServices] ListTablesHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(query, ct));

    [HttpPost("tables")]
    [HasPermission(Permissions.Tables.Manage)]
    [ProducesResponseType<TableDto>(StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateTable(
        [FromBody] SaveTableCommand command, [FromServices] SaveTableHandler handler, CancellationToken ct) =>
        CreatedOrProblem(await handler.HandleAsync(command with { Id = null }, ct));

    [HttpPut("tables/{id:guid}")]
    [HasPermission(Permissions.Tables.Manage)]
    [ProducesResponseType<TableDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateTable(
        Guid id, [FromBody] SaveTableCommand command, [FromServices] SaveTableHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(command with { Id = id }, ct));

    [HttpDelete("tables/{id:guid}")]
    [HasPermission(Permissions.Tables.Manage)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> ArchiveTable(Guid id, [FromServices] ArchiveTableHandler handler, CancellationToken ct) =>
        NoContentOrProblem(await handler.HandleAsync(new ArchiveTableCommand(id), ct));

    [HttpPost("tables/{id:guid}/status")]
    [HasPermission(Permissions.Tables.Manage)]
    [ProducesResponseType<TableDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> SetTableStatus(
        Guid id, [FromBody] SetTableStatusCommand command, [FromServices] SetTableStatusHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(command with { TableId = id }, ct));
}

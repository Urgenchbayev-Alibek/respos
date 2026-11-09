using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Authorization;
using Restaurant.Application.Features.Branches.Common;
using Restaurant.Application.Features.Branches.CreateBranch;
using Restaurant.Application.Features.Branches.DeactivateBranch;
using Restaurant.Application.Features.Branches.GetBranchSettings;
using Restaurant.Application.Features.Branches.ListBranches;
using Restaurant.Application.Features.Branches.UpdateBranch;
using Restaurant.Application.Features.Branches.UpdateBranchSettings;
using Restaurant.Domain.Constants;

namespace Restaurant.Api.Controllers;

[Route(RoutePrefix + "branches")]
public sealed class BranchesController : ApiControllerBase
{
    [HttpGet]
    [HasPermission(Permissions.Branches.Read)]
    [ProducesResponseType<IReadOnlyList<BranchDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromServices] ListBranchesHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new ListBranchesQuery(), ct));

    [HttpPost]
    [HasPermission(Permissions.Branches.Manage)]
    [ProducesResponseType<BranchDto>(StatusCodes.Status201Created)]
    public async Task<IActionResult> Create(
        [FromBody] CreateBranchCommand command, [FromServices] CreateBranchHandler handler, CancellationToken ct) =>
        CreatedOrProblem(await handler.HandleAsync(command, ct));

    [HttpPut("{id:guid}")]
    [HasPermission(Permissions.Branches.Manage)]
    [ProducesResponseType<BranchDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(
        Guid id, [FromBody] UpdateBranchCommand command, [FromServices] UpdateBranchHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(command with { Id = id }, ct));

    [HttpPost("{id:guid}/deactivate")]
    [HasPermission(Permissions.Branches.Manage)]
    [ProducesResponseType<BranchDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Deactivate(Guid id, [FromServices] DeactivateBranchHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new DeactivateBranchCommand(id), ct));

    [HttpGet("{id:guid}/settings")]
    [HasPermission(Permissions.Settings.Manage)]
    [ProducesResponseType<BranchSettingsDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSettings(Guid id, [FromServices] GetBranchSettingsHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new GetBranchSettingsQuery(id), ct));

    [HttpPut("{id:guid}/settings")]
    [HasPermission(Permissions.Settings.Manage)]
    [ProducesResponseType<BranchSettingsDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateSettings(
        Guid id, [FromBody] UpdateBranchSettingsCommand command, [FromServices] UpdateBranchSettingsHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(command with { BranchId = id }, ct));
}

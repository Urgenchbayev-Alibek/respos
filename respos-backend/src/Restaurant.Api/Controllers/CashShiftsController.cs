using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Authorization;
using Restaurant.Api.Filters;
using Restaurant.Application.Common.Models;
using Restaurant.Application.Features.Payments.CashShifts;
using Restaurant.Application.Features.Payments.Common;
using Restaurant.Domain.Constants;

namespace Restaurant.Api.Controllers;

[Route(RoutePrefix + "cash-shifts")]
[RequireBranch]
public sealed class CashShiftsController : ApiControllerBase
{
    /// <summary>The open shift of the branch, or 204 when none is open.</summary>
    [HttpGet("current")]
    [HasPermission(Permissions.CashShifts.Read)]
    [ProducesResponseType<CashShiftDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Current([FromServices] GetCurrentCashShiftHandler h, CancellationToken ct)
    {
        var result = await h.HandleAsync(new GetCurrentCashShiftQuery(), ct);
        if (result.IsFailure)
        {
            return Problem(result.Error);
        }

        return result.Value is null ? NoContent() : Ok(result.Value);
    }

    [HttpGet]
    [HasPermission(Permissions.CashShifts.Read)]
    [ProducesResponseType<PagedResult<CashShiftDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromQuery] ListCashShiftsQuery query, [FromServices] ListCashShiftsHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(query, ct));

    [HttpGet("{id:guid}")]
    [HasPermission(Permissions.CashShifts.Read)]
    [ProducesResponseType<CashShiftDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(Guid id, [FromServices] GetCashShiftHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(new GetCashShiftQuery(id), ct));

    [HttpPost("open")]
    [HasPermission(Permissions.CashShifts.Open)]
    [ProducesResponseType<CashShiftDto>(StatusCodes.Status201Created)]
    public async Task<IActionResult> Open([FromBody] OpenCashShiftCommand command, [FromServices] OpenCashShiftHandler h, CancellationToken ct) =>
        CreatedOrProblem(await h.HandleAsync(command, ct));

    [HttpPost("{id:guid}/close")]
    [HasPermission(Permissions.CashShifts.Close)]
    [ProducesResponseType<CashShiftDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Close(
        Guid id, [FromBody] CloseCashShiftCommand command, [FromServices] CloseCashShiftHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(command with { ShiftId = id }, ct));
}

using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Authorization;
using Restaurant.Api.Filters;
using Restaurant.Application.Common.Models;
using Restaurant.Application.Features.Staff.TimeClock;
using Restaurant.Application.Features.Staff.Timesheet;
using Restaurant.Domain.Constants;

namespace Restaurant.Api.Controllers;

/// <summary>Time clock (own record, <c>staff.timeclock</c>), time entries + timesheet (<c>staff.manage</c>) of the current branch.</summary>
[Route(RoutePrefix + "staff")]
[RequireBranch]
public sealed class StaffTimeController : ApiControllerBase
{
    [HttpGet("time-clock/me")]
    [HasPermission(Permissions.Staff.TimeClock)]
    [ProducesResponseType<MyTimeClockDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Me([FromServices] GetMyTimeClockHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(new GetMyTimeClockQuery(), ct));

    [HttpPost("time-clock/clock-in")]
    [HasPermission(Permissions.Staff.TimeClock)]
    [ProducesResponseType<TimeEntryDto>(StatusCodes.Status201Created)]
    public async Task<IActionResult> ClockIn([FromBody] ClockInCommand command, [FromServices] ClockInHandler h, CancellationToken ct) =>
        CreatedOrProblem(await h.HandleAsync(command, ct));

    [HttpPost("time-clock/clock-out")]
    [HasPermission(Permissions.Staff.TimeClock)]
    [ProducesResponseType<TimeEntryDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> ClockOut([FromBody] ClockOutCommand command, [FromServices] ClockOutHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(command, ct));

    [HttpGet("time-entries")]
    [HasPermission(Permissions.Staff.Manage)]
    [ProducesResponseType<PagedResult<TimeEntryDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Entries([FromQuery] ListTimeEntriesQuery query, [FromServices] ListTimeEntriesHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(query, ct));

    [HttpPost("time-entries")]
    [HasPermission(Permissions.Staff.Manage)]
    [ProducesResponseType<TimeEntryDto>(StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateEntry(
        [FromBody] CreateTimeEntryCommand command, [FromServices] CreateTimeEntryHandler h, CancellationToken ct) =>
        CreatedOrProblem(await h.HandleAsync(command, ct));

    [HttpPut("time-entries/{id:guid}")]
    [HasPermission(Permissions.Staff.Manage)]
    [ProducesResponseType<TimeEntryDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateEntry(
        Guid id, [FromBody] UpdateTimeEntryCommand command, [FromServices] UpdateTimeEntryHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(command with { EntryId = id }, ct));

    [HttpGet("timesheet")]
    [HasPermission(Permissions.Staff.Manage)]
    [ProducesResponseType<TimesheetDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Timesheet([FromQuery] TimesheetQuery query, [FromServices] TimesheetHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(query, ct));

    /// <summary><c>text/csv</c> (UTF-8 with BOM, CSV-injection safe).</summary>
    [HttpGet("timesheet/export")]
    [HasPermission(Permissions.Staff.Manage)]
    [Produces("text/csv", "application/json")]
    public async Task<IActionResult> ExportTimesheet([FromQuery] TimesheetQuery query, [FromServices] ExportTimesheetHandler h, CancellationToken ct)
    {
        var result = await h.HandleAsync(query, ct);
        return result.IsSuccess
            ? File(result.Value.Content, result.Value.ContentType, result.Value.FileName)
            : Problem(result.Error);
    }
}

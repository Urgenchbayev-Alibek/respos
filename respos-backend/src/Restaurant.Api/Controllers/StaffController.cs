using Microsoft.AspNetCore.Mvc;
using Restaurant.Api.Authorization;
using Restaurant.Api.Filters;
using Restaurant.Application.Features.Staff.Devices;
using Restaurant.Application.Features.Staff.Members;
using Restaurant.Application.Features.Staff.Pin;
using Restaurant.Application.Features.Staff.Schedule;
using Restaurant.Domain.Constants;

namespace Restaurant.Api.Controllers;

/// <summary>Staff members (PIN management), shared devices and the shift schedule of the current branch (F6).</summary>
[Route(RoutePrefix + "staff")]
[RequireBranch]
public sealed class StaffController : ApiControllerBase
{
    [HttpGet("members")]
    [HasPermission(Permissions.Staff.Manage)]
    [ProducesResponseType<IReadOnlyList<StaffMemberDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Members([FromServices] ListMembersHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(new ListMembersQuery(), ct));

    [HttpPut("members/{userId:guid}/pin")]
    [HasPermission(Permissions.Staff.Manage)]
    [ProducesResponseType<PinStatusDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> SetMemberPin(
        Guid userId, [FromBody] SetMemberPinCommand command, [FromServices] SetMemberPinHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(command with { UserId = userId }, ct));

    [HttpDelete("members/{userId:guid}/pin")]
    [HasPermission(Permissions.Staff.Manage)]
    public async Task<IActionResult> ResetMemberPin(Guid userId, [FromServices] ResetMemberPinHandler h, CancellationToken ct) =>
        NoContentOrProblem(await h.HandleAsync(new ResetMemberPinCommand(userId), ct));

    [HttpGet("devices")]
    [HasPermission(Permissions.Staff.Manage)]
    [ProducesResponseType<IReadOnlyList<DeviceDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Devices([FromQuery] bool includeRevoked, [FromServices] ListDevicesHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(new ListDevicesQuery(includeRevoked), ct));

    [HttpPost("devices/{id:guid}/revoke")]
    [HasPermission(Permissions.Staff.Manage)]
    [ProducesResponseType<DeviceDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> RevokeDevice(Guid id, [FromServices] RevokeDeviceHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(new RevokeDeviceCommand(id), ct));

    [HttpGet("schedule")]
    [HasPermission(Permissions.Staff.Manage)]
    [ProducesResponseType<IReadOnlyList<ShiftDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Schedule([FromQuery] ListShiftsQuery query, [FromServices] ListShiftsHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(query, ct));

    /// <summary>The caller's own shifts (any signed-in member of the branch).</summary>
    [HttpGet("schedule/my")]
    [ProducesResponseType<IReadOnlyList<ShiftDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> MySchedule([FromQuery] ListMyShiftsQuery query, [FromServices] ListMyShiftsHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(query, ct));

    [HttpPost("schedule")]
    [HasPermission(Permissions.Staff.Manage)]
    [ProducesResponseType<ShiftDto>(StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateShift([FromBody] SaveShiftCommand command, [FromServices] SaveShiftHandler h, CancellationToken ct) =>
        CreatedOrProblem(await h.HandleAsync(command with { ShiftId = null }, ct));

    [HttpPut("schedule/{id:guid}")]
    [HasPermission(Permissions.Staff.Manage)]
    [ProducesResponseType<ShiftDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateShift(
        Guid id, [FromBody] SaveShiftCommand command, [FromServices] SaveShiftHandler h, CancellationToken ct) =>
        OkOrProblem(await h.HandleAsync(command with { ShiftId = id }, ct));

    [HttpDelete("schedule/{id:guid}")]
    [HasPermission(Permissions.Staff.Manage)]
    public async Task<IActionResult> DeleteShift(Guid id, [FromServices] DeleteShiftHandler h, CancellationToken ct) =>
        NoContentOrProblem(await h.HandleAsync(new DeleteShiftCommand(id), ct));
}

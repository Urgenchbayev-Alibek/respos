using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using Restaurant.Api.Authorization;
using Restaurant.Api.Extensions;
using Restaurant.Api.Filters;
using Restaurant.Application.Features.Auth.Common;
using Restaurant.Application.Features.Staff.Devices;
using Restaurant.Application.Features.Staff.Pin;
using Restaurant.Domain.Constants;

namespace Restaurant.Api.Controllers;

/// <summary>
/// Shared-device mode + PIN quick login (ADR-0014, contract <c>respos-contracts/v2/F6-staff.md</c>). The device credential travels
/// only in the httpOnly cookie <c>device_token</c> (path <c>/api/v1/auth</c>), never in bodies or JS-readable storage.
/// </summary>
[Route(RoutePrefix + "auth")]
public sealed class DeviceAuthController(IOptions<AuthOptions> authOptions) : ApiControllerBase
{
    [HttpGet("device")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitingExtensions.AuthPolicy)]
    [ProducesResponseType<CurrentDeviceDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Current([FromServices] GetCurrentDeviceHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new GetCurrentDeviceQuery(DeviceCookie()), ct));

    [HttpGet("device/staff")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitingExtensions.AuthPolicy)]
    [ProducesResponseType<IReadOnlyList<DeviceStaffDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Staff([FromServices] ListDeviceStaffHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new ListDeviceStaffQuery(DeviceCookie()), ct));

    [HttpPost("device/register")]
    [RequireBranch]
    [HasPermission(Permissions.Staff.Manage)]
    [ProducesResponseType<DeviceDto>(StatusCodes.Status201Created)]
    public async Task<IActionResult> Register(
        [FromBody] RegisterDeviceCommand command, [FromServices] RegisterDeviceHandler handler, CancellationToken ct)
    {
        var result = await handler.HandleAsync(command, ct);
        if (result.IsFailure)
        {
            return Problem(result.Error);
        }

        Response.Cookies.Append(AuthCookies.DeviceName, result.Value.RawToken, AuthCookies.Options(authOptions.Value, result.Value.ExpiresAt));
        return StatusCode(StatusCodes.Status201Created, result.Value.Device);
    }

    [HttpPost("device/forget")]
    [HasPermission(Permissions.Staff.Manage)]
    public async Task<IActionResult> Forget([FromServices] ForgetDeviceHandler handler, CancellationToken ct)
    {
        await handler.HandleAsync(new ForgetDeviceCommand(DeviceCookie()), ct);
        Response.Cookies.Delete(AuthCookies.DeviceName, AuthCookies.Options(authOptions.Value, null));
        return NoContent();
    }

    [HttpPost("pin-login")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitingExtensions.AuthPolicy)]
    [ProducesResponseType<AuthResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> PinLogin([FromBody] PinLoginCommand command, [FromServices] PinLoginHandler handler, CancellationToken ct)
    {
        var result = await handler.HandleAsync(command with
        {
            DeviceToken = DeviceCookie(),
            PreviousRefreshToken = AuthCookies.Read(Request, AuthCookies.RefreshName),
        }, ct);
        if (result.IsFailure)
        {
            return Problem(result.Error);
        }

        Response.Cookies.Append(
            AuthCookies.RefreshName, result.Value.RefreshToken, AuthCookies.Options(authOptions.Value, result.Value.RefreshTokenExpiresAt));
        return Ok(result.Value.Response);
    }

    [HttpGet("pin")]
    [ProducesResponseType<PinStatusDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPin([FromServices] GetMyPinHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new GetMyPinQuery(), ct));

    [HttpPut("pin")]
    [ProducesResponseType<PinStatusDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> SetPin([FromBody] SetMyPinCommand command, [FromServices] SetMyPinHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(command, ct));

    [HttpDelete("pin")]
    public async Task<IActionResult> RemovePin([FromServices] RemoveMyPinHandler handler, CancellationToken ct) =>
        NoContentOrProblem(await handler.HandleAsync(new RemoveMyPinCommand(), ct));

    private string? DeviceCookie() => AuthCookies.Read(Request, AuthCookies.DeviceName);
}

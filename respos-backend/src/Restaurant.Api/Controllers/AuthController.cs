using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using Restaurant.Api.Extensions;
using Restaurant.Api.Filters;
using Restaurant.Application.Features.Auth.AcceptInvitation;
using Restaurant.Application.Features.Auth.Common;
using Restaurant.Application.Features.Auth.Login;
using Restaurant.Application.Features.Auth.Passwords;
using Restaurant.Application.Features.Auth.Refresh;
using Restaurant.Application.Features.Auth.Session;
using Restaurant.Domain.Common;

namespace Restaurant.Api.Controllers;

/// <summary>Auth endpoints (CONVENTIONS.md "Auth flow"). Refresh token lives only in an httpOnly cookie.</summary>
[Route(RoutePrefix + "auth")]
public sealed class AuthController(IOptions<AuthOptions> authOptions) : ApiControllerBase
{
    public const string RefreshCookieName = AuthCookies.RefreshName;
    public const string RefreshCookiePath = AuthCookies.Path;

    [HttpPost("login")]
    [AllowAnonymous]
    [LoginRateLimit]
    [ProducesResponseType<AuthResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Login([FromBody] LoginCommand command, [FromServices] LoginHandler handler, CancellationToken ct) =>
        SessionResult(await handler.HandleAsync(command, ct));

    [HttpPost("refresh")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitingExtensions.RefreshPolicy)]
    [ProducesResponseType<AuthResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Refresh([FromServices] RefreshHandler handler, CancellationToken ct)
    {
        var command = new RefreshCommand(ReadRefreshCookie()) { DeviceToken = AuthCookies.Read(Request, AuthCookies.DeviceName) };
        var result = await handler.HandleAsync(command, ct);
        if (result.IsFailure)
        {
            ClearRefreshCookie();
        }

        return SessionResult(result);
    }

    [HttpPost("logout")]
    [AllowAnonymous]
    public async Task<IActionResult> Logout([FromServices] LogoutHandler handler, CancellationToken ct)
    {
        await handler.HandleAsync(new LogoutCommand(ReadRefreshCookie()), ct);
        ClearRefreshCookie();
        return NoContent();
    }

    [HttpPost("switch-organization")]
    [ProducesResponseType<AuthResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> SwitchOrganization(
        [FromBody] SwitchOrganizationCommand command, [FromServices] SwitchOrganizationHandler handler, CancellationToken ct) =>
        SessionResult(await handler.HandleAsync(command with { CurrentRefreshToken = ReadRefreshCookie() }, ct));

    [HttpGet("me")]
    [ProducesResponseType<MeDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Me([FromServices] GetMeHandler handler, CancellationToken ct) =>
        OkOrProblem(await handler.HandleAsync(new GetMeQuery(), ct));

    [HttpPost("forgot-password")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitingExtensions.AuthPolicy)]
    public async Task<IActionResult> ForgotPassword(
        [FromBody] ForgotPasswordCommand command, [FromServices] ForgotPasswordHandler handler, CancellationToken ct) =>
        AcceptedOrProblem(await handler.HandleAsync(command, ct));

    [HttpPost("reset-password")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitingExtensions.AuthPolicy)]
    public async Task<IActionResult> ResetPassword(
        [FromBody] ResetPasswordCommand command, [FromServices] ResetPasswordHandler handler, CancellationToken ct) =>
        NoContentOrProblem(await handler.HandleAsync(command, ct));

    [HttpPost("accept-invitation")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitingExtensions.AuthPolicy)]
    [ProducesResponseType<AuthResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> AcceptInvitation(
        [FromBody] AcceptInvitationCommand command, [FromServices] AcceptInvitationHandler handler, CancellationToken ct) =>
        SessionResult(await handler.HandleAsync(command, ct));

    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword(
        [FromBody] ChangePasswordCommand command, [FromServices] ChangePasswordHandler handler, CancellationToken ct) =>
        NoContentOrProblem(await handler.HandleAsync(command with { CurrentRefreshToken = ReadRefreshCookie() }, ct));

    private IActionResult SessionResult(Result<AuthSession> result)
    {
        if (result.IsFailure)
        {
            return Problem(result.Error);
        }

        Response.Cookies.Append(RefreshCookieName, result.Value.RefreshToken, CookieOptions(result.Value.RefreshTokenExpiresAt));
        return Ok(result.Value.Response);
    }

    private string? ReadRefreshCookie() => AuthCookies.Read(Request, RefreshCookieName);

    private void ClearRefreshCookie() => Response.Cookies.Delete(RefreshCookieName, CookieOptions(null));

    private CookieOptions CookieOptions(DateTime? expires) => AuthCookies.Options(authOptions.Value, expires);
}

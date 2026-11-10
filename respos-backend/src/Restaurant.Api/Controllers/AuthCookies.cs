using Restaurant.Application.Features.Auth.Common;

namespace Restaurant.Api.Controllers;

/// <summary>
/// httpOnly auth cookies (path <c>/api/v1/auth</c>): <c>refresh_token</c> (ADR-0003) and the shared-device credential
/// <c>device_token</c> (ADR-0014). SameSite/Secure come from <see cref="AuthOptions"/>.
/// </summary>
internal static class AuthCookies
{
    public const string RefreshName = "refresh_token";
    public const string DeviceName = "device_token";
    public const string Path = "/api/v1/auth";

    public static CookieOptions Options(AuthOptions settings, DateTime? expires)
    {
        var sameSite = Enum.TryParse<SameSiteMode>(settings.RefreshCookieSameSite, ignoreCase: true, out var parsed)
            ? parsed
            : SameSiteMode.Lax;
        return new CookieOptions
        {
            HttpOnly = true,
            Secure = settings.RefreshCookieSecure || sameSite == SameSiteMode.None,
            SameSite = sameSite,
            Path = Path,
            Expires = expires,
            IsEssential = true,
        };
    }

    public static string? Read(HttpRequest request, string name) =>
        request.Cookies.TryGetValue(name, out var value) ? value : null;
}

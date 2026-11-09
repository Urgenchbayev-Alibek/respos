using Restaurant.Domain.Common;

namespace Restaurant.Application.Features.Auth.Common;

public static class AuthErrors
{
    public static readonly Error InvalidCredentials =
        Error.Unauthorized("auth.invalid_credentials", "Invalid e-mail or password.");

    public static readonly Error AccountLocked =
        Error.Unauthorized("auth.account_locked", "Too many failed attempts. The account is temporarily locked.");

    public static readonly Error AccountBlocked =
        Error.Forbidden("auth.account_blocked", "The account is blocked or deactivated.");

    public static readonly Error TokenExpired =
        Error.Validation("auth.token_expired", "The link has expired. Request a new one.");

    public static readonly Error SessionExpired =
        Error.Unauthorized("auth.token_expired", "The session has expired. Please sign in again.");

    public static readonly Error OrganizationSuspended =
        Error.Forbidden("organization.suspended", "The organization is suspended.");

    public static readonly Error NoOrganization =
        Error.Forbidden("auth.no_organization", "The user has no active organization.");

    public static readonly Error OrganizationForbidden =
        Error.Forbidden("auth.organization_forbidden", "The user is not an active member of this organization.");

    public static readonly Error InvalidRefreshToken =
        Error.Unauthorized("auth.invalid_refresh_token", "The session has expired. Please sign in again.");

    public static readonly Error RefreshTokenReused =
        Error.Unauthorized("auth.refresh_token_reused", "The session was revoked for security reasons. Please sign in again.");

    public static readonly Error InvalidToken =
        Error.Validation("auth.invalid_token", "The link is invalid or has expired.");

    public static readonly Error InvalidCurrentPassword =
        Error.Validation("auth.invalid_current_password", "The current password is incorrect.");
}

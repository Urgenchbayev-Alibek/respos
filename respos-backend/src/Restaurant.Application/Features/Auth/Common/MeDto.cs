namespace Restaurant.Application.Features.Auth.Common;

public sealed record CurrentOrganizationDto(Guid Id, string Name, string Currency, string DefaultLanguage);

public sealed record OrganizationRefDto(Guid Id, string Name);

public sealed record MeBranchDto(Guid Id, string Name, string Timezone);

/// <summary>Contract MeDto (CONVENTIONS.md).</summary>
public sealed record MeDto(
    Guid Id,
    string Email,
    string FullName,
    string PreferredLanguage,
    bool IsPlatformAdmin,
    CurrentOrganizationDto? CurrentOrganization,
    IReadOnlyList<OrganizationRefDto> Organizations,
    IReadOnlyList<string> Roles,
    IReadOnlyList<string> Permissions,
    IReadOnlyList<MeBranchDto> Branches);

/// <summary>Login/refresh response body. The refresh token itself travels only in the httpOnly cookie.</summary>
public sealed record AuthResponse(string AccessToken, DateTime ExpiresAt, MeDto User);

/// <summary>Result of issuing a session: response body + raw refresh token for the cookie.</summary>
public sealed record AuthSession(AuthResponse Response, string RefreshToken, DateTime RefreshTokenExpiresAt);

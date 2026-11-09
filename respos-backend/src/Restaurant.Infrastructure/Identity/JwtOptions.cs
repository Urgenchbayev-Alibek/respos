namespace Restaurant.Infrastructure.Identity;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";
    public const string OrganizationClaim = "org";
    public const string PlatformAdminClaim = "platform_admin";

    /// <summary>Break-glass token marker (value <see cref="ReadOnlyTenantAccess"/>).</summary>
    public const string TenantAccessClaim = "tenant_access";
    public const string ReadOnlyTenantAccess = "read_only";

    public string Issuer { get; set; } = "respos";
    public string Audience { get; set; } = "respos";

    /// <summary>HMAC-SHA256 key, at least 32 bytes. Must come from env/secret store outside Development.</summary>
    public string SigningKey { get; set; } = string.Empty;

    public int AccessTokenMinutes { get; set; } = 15;
}

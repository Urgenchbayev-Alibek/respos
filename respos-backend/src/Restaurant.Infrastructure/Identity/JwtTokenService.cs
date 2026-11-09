using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Security;
using Restaurant.Domain.Entities.Identity;

namespace Restaurant.Infrastructure.Identity;

/// <summary>Issues HS256 access tokens. Permissions are intentionally NOT included (loaded from DB per request).</summary>
public sealed class JwtTokenService(IOptions<JwtOptions> options, IClock clock) : ITokenService
{
    private readonly JsonWebTokenHandler _handler = new();

    public AccessToken CreateAccessToken(User user, Guid? organizationId) =>
        Create(user, organizationId, TimeSpan.FromMinutes(options.Value.AccessTokenMinutes), readOnlyTenantAccess: false);

    public AccessToken CreateTenantAccessToken(User user, Guid organizationId, TimeSpan lifetime) =>
        Create(user, organizationId, lifetime, readOnlyTenantAccess: true);

    private AccessToken Create(User user, Guid? organizationId, TimeSpan lifetime, bool readOnlyTenantAccess)
    {
        var settings = options.Value;
        var now = clock.UtcNow;
        var expires = now.Add(lifetime);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new(JwtOptions.PlatformAdminClaim, user.IsPlatformAdmin ? "true" : "false"),
        };
        if (organizationId is { } orgId)
        {
            claims.Add(new Claim(JwtOptions.OrganizationClaim, orgId.ToString()));
        }

        if (readOnlyTenantAccess)
        {
            claims.Add(new Claim(JwtOptions.TenantAccessClaim, JwtOptions.ReadOnlyTenantAccess));
        }

        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = settings.Issuer,
            Audience = settings.Audience,
            Subject = new ClaimsIdentity(claims),
            IssuedAt = now,
            NotBefore = now,
            Expires = expires,
            SigningCredentials = new SigningCredentials(CreateKey(settings.SigningKey), SecurityAlgorithms.HmacSha256),
        };
        return new AccessToken(_handler.CreateToken(descriptor), expires);
    }

    public static SymmetricSecurityKey CreateKey(string signingKey)
    {
        var bytes = Encoding.UTF8.GetBytes(signingKey);
        if (bytes.Length < 32)
        {
            throw new InvalidOperationException("Jwt:SigningKey must be at least 32 bytes.");
        }

        return new SymmetricSecurityKey(bytes);
    }
}

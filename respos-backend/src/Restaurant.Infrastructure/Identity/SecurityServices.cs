using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Restaurant.Application.Abstractions.Security;
using Restaurant.Domain.Entities.Identity;
using IAppPasswordHasher = Restaurant.Application.Abstractions.Security.IPasswordHasher;

namespace Restaurant.Infrastructure.Identity;

/// <summary>PBKDF2 hashing via ASP.NET Core Identity's PasswordHasher (no full Identity stack).</summary>
internal sealed class IdentityPasswordHasher : IAppPasswordHasher
{
    private static readonly User Subject = new();
    private readonly PasswordHasher<User> _hasher = new();

    public string Hash(string password) => _hasher.HashPassword(Subject, password);

    public bool Verify(string passwordHash, string password) =>
        _hasher.VerifyHashedPassword(Subject, passwordHash, password) != PasswordVerificationResult.Failed;
}

/// <summary>256-bit random URL-safe tokens; persisted only as SHA-256 hex hashes.</summary>
internal sealed class SecureTokenGenerator : ISecureTokenGenerator
{
    private const int TokenBytes = 32;

    public string Generate() => WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(TokenBytes));

    public string Hash(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}

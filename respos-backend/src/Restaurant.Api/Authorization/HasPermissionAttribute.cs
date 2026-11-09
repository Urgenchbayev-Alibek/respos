using Microsoft.AspNetCore.Authorization;

namespace Restaurant.Api.Authorization;

/// <summary>
/// Requires ANY of the given permissions (DB-loaded, cached per request).
/// Usage: <c>[HasPermission(Permissions.Users.Read)]</c>. Platform permissions require IsPlatformAdmin.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
public sealed class HasPermissionAttribute : AuthorizeAttribute
{
    public const string PolicyPrefix = "perm:";

    public HasPermissionAttribute(params string[] permissions)
    {
        if (permissions.Length == 0)
        {
            throw new ArgumentException("At least one permission is required.", nameof(permissions));
        }

        Permissions = permissions;
        Policy = PolicyPrefix + string.Join('|', permissions);
    }

    public IReadOnlyList<string> Permissions { get; }
}

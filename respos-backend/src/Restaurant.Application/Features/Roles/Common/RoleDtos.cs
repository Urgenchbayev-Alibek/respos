using FluentValidation;
using Restaurant.Application.Common.Validation;
using Restaurant.Domain.Common;
using Restaurant.Domain.Constants;

namespace Restaurant.Application.Features.Roles.Common;

public sealed record RoleDto(Guid Id, string Code, string Name, bool IsSystem, IReadOnlyList<string> Permissions, int UserCount);

public sealed record PermissionDto(string Code, string Module, string Description);

public static class RoleErrors
{
    public static readonly Error NotFound = Error.NotFound("role.not_found", "Role not found.");

    public static readonly Error SystemProtected =
        Error.BusinessRule("role.system_protected", "System roles cannot be changed or deleted; create a copy instead.");

    public static readonly Error InUse = Error.BusinessRule("role.in_use", "The role is assigned to users.");

    public static readonly Error NameTaken = Error.Conflict("role.name_taken", "A role with this name already exists.");

    public static Error InvalidPermissions(IEnumerable<string> codes) =>
        Error.Validation("role.invalid_permissions", $"Unknown or non-assignable permissions: {string.Join(", ", codes)}.");
}

public static class RoleRules
{
    public const int NameMaxLength = 100;

    /// <summary>Returns the codes that cannot be assigned to an organization role (unknown or platform.*).</summary>
    public static IReadOnlyList<string> InvalidPermissions(IEnumerable<string> codes) =>
        codes.Where(c => !PermissionCatalog.IsAssignableToRole(c)).Distinct().ToList();

    public static IRuleBuilderOptions<T, string> ValidRoleName<T>(this IRuleBuilder<T, string> rule) =>
        rule.NotEmpty().MaximumLength(Math.Min(NameMaxLength, CommonRules.NameMaxLength));
}

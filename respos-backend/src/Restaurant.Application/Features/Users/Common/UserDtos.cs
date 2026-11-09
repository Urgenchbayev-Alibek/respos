using Restaurant.Domain.Common;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Users.Common;

public sealed record UserRoleDto(Guid Id, string Code, string Name);

public sealed record UserBranchDto(Guid Id, string Name);

public sealed record UserDto(
    Guid Id,
    string Email,
    string FullName,
    string? Phone,
    UserStatus Status,
    IReadOnlyList<UserRoleDto> Roles,
    IReadOnlyList<UserBranchDto> Branches,
    DateTime? LastLoginAt);

public sealed record InvitationCreatedDto(Guid InvitationId, string InviteLink);

public static class UserErrors
{
    public static readonly Error NotFound = Error.NotFound("user.not_found", "User not found.");

    public static readonly Error EmailTaken =
        Error.Conflict("user.email_taken", "A user with this e-mail already exists.");

    public static readonly Error CannotModifySelf =
        Error.BusinessRule("user.cannot_modify_self", "You cannot block or deactivate yourself.");

    public static readonly Error LastOwner =
        Error.BusinessRule("user.last_owner", "The last active owner cannot be blocked, deactivated or lose the owner role.");

    public static readonly Error OwnerProtected =
        Error.Forbidden("user.owner_protected", "Only an owner can modify owners or assign the owner role.");

    public static readonly Error InvalidRoles =
        Error.Validation("user.invalid_roles", "One or more roles do not exist.");

    public static readonly Error InvalidBranches =
        Error.Validation("user.invalid_branches", "One or more branches do not exist.");
}

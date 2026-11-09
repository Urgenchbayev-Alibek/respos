using FluentValidation;
using Restaurant.Application.Common.Validation;

namespace Restaurant.Application.Features.Users.CreateUser;

/// <summary>Direct creation with a temporary password (admin hands it over).</summary>
public sealed record CreateUserCommand(
    string Email,
    string FullName,
    string? Phone,
    string Password,
    IReadOnlyList<Guid> RoleIds,
    IReadOnlyList<Guid> BranchIds);

public sealed class CreateUserValidator : AbstractValidator<CreateUserCommand>
{
    public CreateUserValidator()
    {
        RuleFor(x => x.Email).ValidEmail();
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(CommonRules.NameMaxLength);
        RuleFor(x => x.Phone).ValidPhone();
        RuleFor(x => x.Password).StrongPassword();
        RuleFor(x => x.RoleIds).NotEmpty();
        RuleFor(x => x.BranchIds).NotNull();
    }
}

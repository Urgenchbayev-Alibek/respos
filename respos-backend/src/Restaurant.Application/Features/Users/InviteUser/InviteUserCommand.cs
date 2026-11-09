using FluentValidation;
using Restaurant.Application.Common.Validation;

namespace Restaurant.Application.Features.Users.InviteUser;

public sealed record InviteUserCommand(string Email, string FullName, IReadOnlyList<Guid> RoleIds, IReadOnlyList<Guid> BranchIds);

public sealed class InviteUserValidator : AbstractValidator<InviteUserCommand>
{
    public InviteUserValidator()
    {
        RuleFor(x => x.Email).ValidEmail();
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(CommonRules.NameMaxLength);
        RuleFor(x => x.RoleIds).NotEmpty();
        RuleFor(x => x.BranchIds).NotNull();
    }
}

using FluentValidation;
using Restaurant.Application.Features.Roles.Common;

namespace Restaurant.Application.Features.Roles.CreateRole;

public sealed record CreateRoleCommand(string Name, IReadOnlyList<string> Permissions);

public sealed class CreateRoleValidator : AbstractValidator<CreateRoleCommand>
{
    public CreateRoleValidator()
    {
        RuleFor(x => x.Name).ValidRoleName();
        RuleFor(x => x.Permissions).NotNull();
    }
}

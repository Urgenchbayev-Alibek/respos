using FluentValidation;
using Restaurant.Application.Common.Validation;
using Restaurant.Application.Features.Branches.Common;

namespace Restaurant.Application.Features.Branches.CreateBranch;

public sealed record CreateBranchCommand(string Name, string? Address, string? Phone, string? Timezone);

public sealed class CreateBranchValidator : AbstractValidator<CreateBranchCommand>
{
    public CreateBranchValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(CommonRules.NameMaxLength);
        RuleFor(x => x.Address).MaximumLength(BranchRules.AddressMaxLength);
        RuleFor(x => x.Phone).ValidPhone();
        RuleFor(x => x.Timezone).ValidTimezone();
    }
}

using System.Text.Json.Serialization;
using FluentValidation;
using Restaurant.Application.Common.Validation;
using Restaurant.Application.Features.Branches.Common;

namespace Restaurant.Application.Features.Branches.UpdateBranch;

public sealed record UpdateBranchCommand(string Name, string? Address, string? Phone, string? Timezone)
{
    /// <summary>Taken from the route.</summary>
    [JsonIgnore]
    public Guid Id { get; init; }
}

public sealed class UpdateBranchValidator : AbstractValidator<UpdateBranchCommand>
{
    public UpdateBranchValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(CommonRules.NameMaxLength);
        RuleFor(x => x.Address).MaximumLength(BranchRules.AddressMaxLength);
        RuleFor(x => x.Phone).ValidPhone();
        RuleFor(x => x.Timezone).ValidTimezone();
    }
}

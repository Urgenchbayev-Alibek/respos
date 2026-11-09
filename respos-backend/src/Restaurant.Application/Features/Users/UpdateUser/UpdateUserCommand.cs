using System.Text.Json.Serialization;
using FluentValidation;
using Restaurant.Application.Common.Validation;

namespace Restaurant.Application.Features.Users.UpdateUser;

public sealed record UpdateUserCommand(string FullName, string? Phone, IReadOnlyList<Guid> RoleIds, IReadOnlyList<Guid> BranchIds)
{
    /// <summary>Taken from the route.</summary>
    [JsonIgnore]
    public Guid Id { get; init; }
}

public sealed class UpdateUserValidator : AbstractValidator<UpdateUserCommand>
{
    public UpdateUserValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(CommonRules.NameMaxLength);
        RuleFor(x => x.Phone).ValidPhone();
        RuleFor(x => x.RoleIds).NotEmpty();
        RuleFor(x => x.BranchIds).NotNull();
    }
}

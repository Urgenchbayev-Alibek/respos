using System.Text.Json.Serialization;
using FluentValidation;
using Restaurant.Application.Features.Roles.Common;

namespace Restaurant.Application.Features.Roles.UpdateRole;

public sealed record UpdateRoleCommand(string Name, IReadOnlyList<string> Permissions)
{
    /// <summary>Taken from the route.</summary>
    [JsonIgnore]
    public Guid Id { get; init; }
}

public sealed class UpdateRoleValidator : AbstractValidator<UpdateRoleCommand>
{
    public UpdateRoleValidator()
    {
        RuleFor(x => x.Name).ValidRoleName();
        RuleFor(x => x.Permissions).NotNull();
    }
}

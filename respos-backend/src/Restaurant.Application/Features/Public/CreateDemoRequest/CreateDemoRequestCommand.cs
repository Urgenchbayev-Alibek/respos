using FluentValidation;
using Restaurant.Application.Common.Validation;

namespace Restaurant.Application.Features.Public.CreateDemoRequest;

/// <param name="Website">Honeypot: must be empty (bots fill it). Non-empty → accepted silently but not stored.</param>
public sealed record CreateDemoRequestCommand(
    string Name,
    string Phone,
    string? Email,
    string RestaurantName,
    string? City,
    string? Message,
    string? Website);

public sealed class CreateDemoRequestValidator : AbstractValidator<CreateDemoRequestCommand>
{
    public const int MessageMaxLength = 2000;

    public CreateDemoRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(CommonRules.NameMaxLength);
        RuleFor<string?>(x => x.Phone).NotEmpty().ValidPhone();
        RuleFor(x => x.Email).EmailAddress().MaximumLength(CommonRules.EmailMaxLength).When(x => !string.IsNullOrEmpty(x.Email));
        RuleFor(x => x.RestaurantName).NotEmpty().MaximumLength(CommonRules.NameMaxLength);
        RuleFor(x => x.City).MaximumLength(CommonRules.NameMaxLength);
        RuleFor(x => x.Message).MaximumLength(MessageMaxLength);
    }
}

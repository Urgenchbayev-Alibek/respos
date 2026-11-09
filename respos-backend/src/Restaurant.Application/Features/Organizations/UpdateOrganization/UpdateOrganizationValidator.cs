using FluentValidation;
using Restaurant.Application.Common.Validation;

namespace Restaurant.Application.Features.Organizations.UpdateOrganization;

public sealed class UpdateOrganizationValidator : AbstractValidator<UpdateOrganizationCommand>
{
    public static readonly string[] Languages = ["ru", "uz", "en"];

    public UpdateOrganizationValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(CommonRules.NameMaxLength);
        RuleFor(x => x.Currency).NotEmpty().Matches("^[A-Z]{3}$").WithMessage("Currency must be a 3-letter ISO code.");
        RuleFor(x => x.DefaultLanguage).NotEmpty().Must(l => Languages.Contains(l)).WithMessage("Language must be ru, uz or en.");
    }
}

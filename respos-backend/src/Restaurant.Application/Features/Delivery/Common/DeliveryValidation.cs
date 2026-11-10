using FluentValidation;
using Restaurant.Application.Common.Validation;

namespace Restaurant.Application.Features.Delivery.Common;

/// <summary>Rules for <see cref="IDeliveryDetailsRequest"/>; included by the create/update validators.</summary>
public sealed class DeliveryDetailsValidator : AbstractValidator<IDeliveryDetailsRequest>
{
    public DeliveryDetailsValidator()
    {
        RuleFor(x => x.CustomerName).NotEmpty().MaximumLength(CommonRules.NameMaxLength);
        RuleFor(x => x.CustomerPhone).NormalizablePhone();
        RuleFor(x => x.Address).NotEmpty().MaximumLength(DeliveryDetails.AddressMaxLength);
        RuleFor(x => x.Entrance).MaximumLength(DeliveryDetails.ShortMaxLength);
        RuleFor(x => x.Floor).MaximumLength(DeliveryDetails.ShortMaxLength);
        RuleFor(x => x.Apartment).MaximumLength(DeliveryDetails.ShortMaxLength);
        RuleFor(x => x.Comment).MaximumLength(DeliveryDetails.CommentMaxLength);
    }
}

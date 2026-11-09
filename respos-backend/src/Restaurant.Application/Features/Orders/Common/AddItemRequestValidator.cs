using FluentValidation;

namespace Restaurant.Application.Features.Orders.Common;

public sealed class AddItemRequestValidator : AbstractValidator<AddItemRequest>
{
    public const int MaxItemsPerRequest = 100;
    public const int CommentMaxLength = 500;
    public const decimal MaxQuantity = 1000m;

    public AddItemRequestValidator()
    {
        RuleFor(x => x.MenuItemId).NotEmpty();
        RuleFor(x => x.Quantity).GreaterThan(0m).LessThanOrEqualTo(MaxQuantity).PrecisionScale(18, 3, true);
        RuleFor(x => x.Comment).MaximumLength(CommentMaxLength);
        RuleFor(x => x.ModifierOptionIds).Must(ids => ids is null || ids.Count <= 50).WithMessage("Too many modifiers.");
    }
}

using FluentValidation;
using Restaurant.Application.Features.Orders.Common;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Orders.CreateOrder;

public sealed record CreateOrderCommand(
    OrderType Type,
    Guid? TableId,
    int GuestCount,
    string? Comment,
    IReadOnlyList<AddItemRequest>? Items);

public sealed class CreateOrderValidator : AbstractValidator<CreateOrderCommand>
{
    public CreateOrderValidator()
    {
        RuleFor(x => x.Type).IsInEnum();
        RuleFor(x => x.TableId).NotEmpty().When(x => x.Type == OrderType.DineIn).WithMessage("Dine-in orders require a table.");
        RuleFor(x => x.GuestCount).InclusiveBetween(0, 100);
        RuleFor(x => x.Comment).MaximumLength(1000);
        RuleFor(x => x.Items).Must(i => i is null || i.Count <= AddItemRequestValidator.MaxItemsPerRequest);
        RuleForEach(x => x.Items).SetValidator(new AddItemRequestValidator());
    }
}

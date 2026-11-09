using Restaurant.Application.Common.Extensions;
using FluentValidation;
using Restaurant.Application.Common.Models;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Procurement.Purchases;

public sealed record PurchaseItemDto(
    Guid Id, Guid IngredientId, string IngredientName, decimal Quantity, Guid UnitId, string UnitCode,
    decimal UnitPrice, decimal ReceivedQuantity, decimal LineTotal);

public sealed record PurchaseDto(
    Guid Id, int Number, Guid SupplierId, string SupplierName, PurchaseOrderStatus Status, DateTime? ExpectedAt,
    decimal Total, string? Comment, DateTime CreatedAt, IReadOnlyList<PurchaseItemDto> Items);

/// <summary><c>GET /purchases?status=&amp;supplierId=&amp;from=&amp;to=</c> (by creation time).</summary>
public sealed record ListPurchasesQuery : PageQuery
{
    public string? Status { get; init; }
    public Guid? SupplierId { get; init; }
    public DateTime? From { get; init; }
    public DateTime? To { get; init; }
}

public sealed record GetPurchaseQuery(Guid Id);

public sealed record PurchaseLine(Guid IngredientId, decimal Quantity, Guid UnitId, decimal UnitPrice);

/// <summary>Create (Id null) or update a draft purchase order (items are replaced).</summary>
public sealed record SavePurchaseCommand(Guid SupplierId, DateTime? ExpectedAt, string? Comment, IReadOnlyList<PurchaseLine> Items)
{
    public Guid? Id { get; init; }
}

public sealed record PurchaseActionCommand(Guid Id);

public sealed record ReceiveLine(Guid ItemId, decimal Quantity);

public sealed record ReceivePurchaseCommand(IReadOnlyList<ReceiveLine> Lines)
{
    public Guid Id { get; init; }
}

public sealed class ListPurchasesValidator : AbstractValidator<ListPurchasesQuery>
{
    public ListPurchasesValidator() =>
        RuleFor(x => x.Status).Must(SnakeCaseEnum.IsValidOrEmpty<PurchaseOrderStatus>).WithMessage("Unknown status.");
}

public sealed class SavePurchaseValidator : AbstractValidator<SavePurchaseCommand>
{
    public SavePurchaseValidator()
    {
        RuleFor(x => x.SupplierId).NotEmpty();
        RuleFor(x => x.Comment).MaximumLength(1000);
        RuleFor(x => x.Items).NotEmpty();
        RuleForEach(x => x.Items).ChildRules(line =>
        {
            line.RuleFor(l => l.IngredientId).NotEmpty();
            line.RuleFor(l => l.UnitId).NotEmpty();
            line.RuleFor(l => l.Quantity).GreaterThan(0).PrecisionScale(18, 3, true);
            line.RuleFor(l => l.UnitPrice).GreaterThanOrEqualTo(0).PrecisionScale(18, 2, true);
        });
    }
}

public sealed class ReceivePurchaseValidator : AbstractValidator<ReceivePurchaseCommand>
{
    public ReceivePurchaseValidator()
    {
        RuleFor(x => x.Lines).NotEmpty();
        RuleFor(x => x.Lines).Must(l => l.Select(x => x.ItemId).Distinct().Count() == l.Count)
            .When(x => x.Lines is not null).WithMessage("Duplicate lines.");
        RuleForEach(x => x.Lines).ChildRules(line =>
        {
            line.RuleFor(l => l.ItemId).NotEmpty();
            line.RuleFor(l => l.Quantity).GreaterThan(0).PrecisionScale(18, 3, true);
        });
    }
}

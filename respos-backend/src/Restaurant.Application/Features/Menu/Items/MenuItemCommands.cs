using FluentValidation;
using Restaurant.Application.Common.Models;
using Restaurant.Application.Common.Validation;
using Restaurant.Application.Features.Menu.Common;

namespace Restaurant.Application.Features.Menu.Items;

/// <summary><c>GET /menu/items?categoryId=&amp;search=&amp;isAvailable=&amp;includeArchived=</c>.</summary>
public sealed record ListMenuItemsQuery : PageQuery
{
    public Guid? CategoryId { get; init; }
    public bool? IsAvailable { get; init; }
    public bool IncludeArchived { get; init; }
}

public sealed record GetMenuItemQuery(Guid Id);

public sealed record MenuItemVariantInput(Guid? Id, string Name, decimal Price, bool IsDefault);

public sealed record SaveMenuItemCommand(
    Guid CategoryId,
    string Name,
    string? NameUz,
    string? Description,
    decimal Price,
    int PrepTimeMinutes,
    Guid? KitchenStationId,
    bool? IsAvailable,
    string? Sku,
    IReadOnlyList<MenuItemVariantInput>? Variants,
    IReadOnlyList<Guid>? ModifierGroupIds,
    IReadOnlyList<MenuAvailabilityDto>? Availability)
{
    /// <summary>Null = create.</summary>
    public Guid? Id { get; init; }
}

public sealed record ArchiveMenuItemCommand(Guid Id);

public sealed record SetMenuItemAvailabilityCommand(bool IsAvailable)
{
    public Guid ItemId { get; init; }
}

public sealed record UploadMenuItemPhotoCommand(Guid ItemId, Stream Content, string FileName, string ContentType, long Length);

public sealed class SaveMenuItemValidator : AbstractValidator<SaveMenuItemCommand>
{
    public const int MaxChildren = 50;

    public SaveMenuItemValidator()
    {
        RuleFor(x => x.CategoryId).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(CommonRules.NameMaxLength);
        RuleFor(x => x.NameUz).MaximumLength(CommonRules.NameMaxLength);
        RuleFor(x => x.Description).MaximumLength(MenuRules.DescriptionMaxLength);
        RuleFor(x => x.Sku).MaximumLength(MenuRules.SkuMaxLength);
        RuleFor(x => x.Price).ValidMoney();
        RuleFor(x => x.PrepTimeMinutes).InclusiveBetween(0, MenuRules.MaxPrepTimeMinutes);

        RuleFor(x => x.Variants!).Must(v => v.Count <= MaxChildren).WithMessage($"At most {MaxChildren} variants.")
            .Must(v => v.Count(x => x.IsDefault) <= 1).WithMessage("Only one variant can be the default.")
            .Must(v => v.Where(x => x.Id != null).Select(x => x.Id).Distinct().Count() == v.Count(x => x.Id != null))
            .WithMessage("Variant ids must be unique.")
            .When(x => x.Variants is not null);
        RuleForEach(x => x.Variants).ChildRules(variant =>
        {
            variant.RuleFor(v => v.Name).NotEmpty().MaximumLength(CommonRules.NameMaxLength);
            variant.RuleFor(v => v.Price).ValidMoney();
        });

        RuleFor(x => x.ModifierGroupIds!).Must(ids => ids.Count <= MaxChildren && ids.Distinct().Count() == ids.Count)
            .WithMessage("Modifier group ids must be unique.")
            .When(x => x.ModifierGroupIds is not null);

        RuleFor(x => x.Availability!).Must(a => a.Count <= MaxChildren).WithMessage($"At most {MaxChildren} windows.")
            .When(x => x.Availability is not null);
        RuleForEach(x => x.Availability).ChildRules(window =>
        {
            window.RuleFor(w => w.DayOfWeek).IsInEnum();
            window.RuleFor(w => w.EndTime).NotEqual(w => w.StartTime).WithMessage("Window must not be empty.");
        });
    }
}

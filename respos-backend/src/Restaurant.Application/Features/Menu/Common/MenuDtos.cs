namespace Restaurant.Application.Features.Menu.Common;

public sealed record MenuCategoryDto(Guid Id, string Name, string? NameUz, int SortOrder, bool IsActive, bool IsArchived, int ItemCount);

public sealed record MenuItemVariantDto(Guid Id, string Name, decimal Price, bool IsDefault);

public sealed record ModifierOptionDto(Guid Id, string Name, decimal PriceDelta);

public sealed record ModifierGroupDto(Guid Id, string Name, int MinSelect, int MaxSelect, bool IsRequired, IReadOnlyList<ModifierOptionDto> Options);

/// <summary>Time-of-day window in branch time; <c>dayOfWeek</c> null = every day; end ≤ start = overnight.</summary>
public sealed record MenuAvailabilityDto(DayOfWeek? DayOfWeek, TimeOnly StartTime, TimeOnly EndTime);

public sealed record MenuItemDto(
    Guid Id,
    Guid CategoryId,
    string CategoryName,
    string Name,
    string? NameUz,
    string? Description,
    string? PhotoUrl,
    decimal Price,
    int PrepTimeMinutes,
    Guid? KitchenStationId,
    bool IsAvailable,
    bool IsArchived,
    string? Sku,
    IReadOnlyList<MenuItemVariantDto> Variants,
    IReadOnlyList<ModifierGroupDto> ModifierGroups,
    IReadOnlyList<MenuAvailabilityDto> Availability);

/// <summary><c>GET /menu/pos</c> category with the items orderable right now.</summary>
public sealed record PosCategoryDto(Guid Id, string Name, string? NameUz, int SortOrder, IReadOnlyList<MenuItemDto> Items);

public sealed record MenuPhotoDto(string PhotoUrl);

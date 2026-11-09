using Restaurant.Domain.Entities.Kitchen;
using Restaurant.Domain.Entities.Menu;

namespace Restaurant.Infrastructure.Persistence.Seed.Demo;

/// <summary>Uzbek demo menu: categories, items (prices in UZS), variants with absolute prices, modifier groups.</summary>
internal static class DemoMenu
{
    private sealed record ItemSpec(
        string Key, string Category, string Name, string NameUz, decimal Price, int PrepMinutes, char Station,
        (string Name, decimal Price)[]? Variants = null, bool Spicy = false, bool Addons = false);

    private static readonly (string Key, string Name, string NameUz)[] Categories =
    [
        ("hot", "Горячие блюда", "Issiq taomlar"),
        ("shashlik", "Шашлык", "Shashlik"),
        ("bakery", "Выпечка", "Pishiriqlar"),
        ("salads", "Салаты", "Salatlar"),
        ("drinks", "Напитки", "Ichimliklar"),
        ("tea", "Чай", "Choy"),
    ];

    private static readonly ItemSpec[] Items =
    [
        new("plov", "hot", "Плов ташкентский", "Toshkent oshi", 45000m, 15, 'H', [("Порция", 45000m), ("0.5 порции", 28000m)], Addons: true),
        new("lagman", "hot", "Лагман", "Lag'mon", 38000m, 15, 'H', Spicy: true, Addons: true),
        new("manti", "hot", "Манты", "Manti", 32000m, 25, 'H', Addons: true),
        new("shashlik", "shashlik", "Шашлык", "Shashlik", 30000m, 20, 'H',
            [("Баранина", 30000m), ("Говядина", 28000m), ("Курица", 22000m)], Spicy: true, Addons: true),
        new("samsa", "bakery", "Самса", "Somsa", 12000m, 10, 'H'),
        new("achichuk", "salads", "Ачичук", "Achchiq-chuchuk", 15000m, 5, 'C'),
        new("caesar", "salads", "Салат Цезарь", "Sezar salati", 42000m, 10, 'C'),
        new("tea_green", "tea", "Зелёный чай (чайник)", "Ko'k choy (choynak)", 8000m, 3, 'B'),
        new("tea_black", "tea", "Чёрный чай (чайник)", "Qora choy (choynak)", 8000m, 3, 'B'),
        new("compote", "drinks", "Компот", "Kompot", 10000m, 1, 'B'),
        new("cola", "drinks", "Кока-Кола 0.5 л", "Coca-Cola 0,5 l", 12000m, 1, 'B'),
    ];

    public static IReadOnlyDictionary<string, MenuItem> Add(DemoContext context, DemoStations stations)
    {
        var categories = new Dictionary<string, MenuCategory>(StringComparer.Ordinal);
        var sortOrder = 0;
        foreach (var (key, name, nameUz) in Categories)
        {
            var category = new MenuCategory { OrganizationId = context.OrganizationId, Name = name, NameUz = nameUz, SortOrder = ++sortOrder };
            context.Db.MenuCategories.Add(category);
            categories[key] = category;
        }

        var spice = Group(context, "Острота", 0, 1, [("Без остроты", 0m), ("Острый", 0m)]);
        var addons = Group(context, "Добавки", 0, 3, [("Лепёшка", 5000m), ("Доп. соус", 3000m)]);

        var items = new Dictionary<string, MenuItem>(StringComparer.Ordinal);
        foreach (var spec in Items)
        {
            var item = new MenuItem
            {
                OrganizationId = context.OrganizationId,
                CategoryId = categories[spec.Category].Id,
                Name = spec.Name,
                NameUz = spec.NameUz,
                Price = spec.Price,
                PrepTimeMinutes = spec.PrepMinutes,
                KitchenStationId = StationFor(spec.Station, stations).Id,
                Sku = spec.Key.ToUpperInvariant(),
            };
            AddVariants(item, spec.Variants);
            if (spec.Spicy)
            {
                item.ModifierGroups.Add(new MenuItemModifierGroup { MenuItemId = item.Id, ModifierGroupId = spice.Id, SortOrder = 1 });
            }

            if (spec.Addons)
            {
                item.ModifierGroups.Add(new MenuItemModifierGroup { MenuItemId = item.Id, ModifierGroupId = addons.Id, SortOrder = 2 });
            }

            context.Db.MenuItems.Add(item);
            items[spec.Key] = item;
        }

        return items;
    }

    private static void AddVariants(MenuItem item, (string Name, decimal Price)[]? variants)
    {
        if (variants is null)
        {
            return;
        }

        for (var i = 0; i < variants.Length; i++)
        {
            item.Variants.Add(new MenuItemVariant { MenuItemId = item.Id, Name = variants[i].Name, Price = variants[i].Price, IsDefault = i == 0 });
        }
    }

    private static KitchenStation StationFor(char code, DemoStations stations) => code switch
    {
        'C' => stations.Cold,
        'B' => stations.Bar,
        _ => stations.Hot,
    };

    private static ModifierGroup Group(DemoContext context, string name, int min, int max, (string Name, decimal Delta)[] options)
    {
        var group = new ModifierGroup { OrganizationId = context.OrganizationId, Name = name, MinSelect = min, MaxSelect = max };
        for (var i = 0; i < options.Length; i++)
        {
            group.Options.Add(new ModifierOption { GroupId = group.Id, Name = options[i].Name, PriceDelta = options[i].Delta, SortOrder = i + 1 });
        }

        context.Db.ModifierGroups.Add(group);
        return group;
    }
}

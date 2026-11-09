using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Entities.Saas;
using Restaurant.Infrastructure.Persistence.Context;

namespace Restaurant.Infrastructure.Persistence.Seed;

/// <summary>Upserts SaaS features and plans (by Code) and their feature sets.</summary>
internal sealed class PlanSeeder : IDataSeeder
{
    private static readonly (string Code, string Name)[] Features =
    [
        ("reservations", "Бронирования"),
        ("kds", "Кухонный экран (KDS)"),
        ("inventory", "Склад и рецептуры"),
        ("procurement", "Поставщики и закупки"),
        ("reports", "Отчёты"),
        ("csv_export", "Экспорт CSV"),
        ("multi_branch", "Несколько филиалов"),
    ];

    private static readonly (string Code, string Name, int MaxBranches, int MaxUsers, string[] Features)[] Plans =
    [
        (Plan.Starter, "Starter", 1, 10, ["reservations", "kds", "inventory"]),
        (Plan.Business, "Business", 5, 50, ["reservations", "kds", "inventory", "procurement", "reports", "csv_export", "multi_branch"]),
        (Plan.Enterprise, "Enterprise", 100, 1000, ["reservations", "kds", "inventory", "procurement", "reports", "csv_export", "multi_branch"]),
    ];

    public int Order => 20;

    public async Task SeedAsync(AppDbContext db, CancellationToken cancellationToken)
    {
        var features = await db.Features.ToDictionaryAsync(f => f.Code, StringComparer.Ordinal, cancellationToken);
        foreach (var (code, name) in Features)
        {
            if (features.TryGetValue(code, out var feature))
            {
                feature.Name = name;
            }
            else
            {
                db.Features.Add(new Feature { Code = code, Name = name });
            }
        }

        var plans = await db.Plans.Include(p => p.Features).ToDictionaryAsync(p => p.Code, StringComparer.Ordinal, cancellationToken);
        foreach (var definition in Plans)
        {
            if (!plans.TryGetValue(definition.Code, out var plan))
            {
                plan = new Plan { Code = definition.Code };
                db.Plans.Add(plan);
            }

            plan.Name = definition.Name;
            plan.MaxBranches = definition.MaxBranches;
            plan.MaxUsers = definition.MaxUsers;
            foreach (var featureCode in definition.Features.Where(c => plan.Features.All(f => f.FeatureCode != c)))
            {
                plan.Features.Add(new PlanFeature { PlanId = plan.Id, FeatureCode = featureCode });
            }
        }

        await db.SaveChangesAsync(cancellationToken);
    }
}

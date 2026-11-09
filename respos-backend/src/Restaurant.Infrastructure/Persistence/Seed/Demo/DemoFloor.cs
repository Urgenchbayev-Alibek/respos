using Restaurant.Domain.Entities.Floor;
using Restaurant.Domain.Entities.Kitchen;

namespace Restaurant.Infrastructure.Persistence.Seed.Demo;

internal sealed record DemoStations(KitchenStation Hot, KitchenStation Cold, KitchenStation Bar);

/// <summary>Two dining areas, ten tables (floor-plan grid) and three kitchen stations.</summary>
internal static class DemoFloor
{
    private const int TablesPerRow = 4;
    private const decimal GridStep = 120m;
    private const decimal GridOffset = 40m;
    private static readonly int[] Capacities = [2, 4, 4, 6, 2, 4, 4, 4, 6, 2];
    private const int MainHallTables = 6;

    public static DemoStations Add(DemoContext context)
    {
        var main = Area(context, "Основной зал", 1);
        var terrace = Area(context, "Терраса", 2);
        for (var i = 0; i < Capacities.Length; i++)
        {
            var area = i < MainHallTables ? main : terrace;
            var position = i < MainHallTables ? i : i - MainHallTables;
            context.Db.DiningTables.Add(new DiningTable
            {
                OrganizationId = context.OrganizationId,
                BranchId = context.BranchId,
                DiningAreaId = area.Id,
                Number = (i + 1).ToString(System.Globalization.CultureInfo.InvariantCulture),
                Capacity = Capacities[i],
                PosX = GridOffset + (position % TablesPerRow) * GridStep,
                PosY = GridOffset + (position / TablesPerRow) * GridStep,
            });
        }

        return new DemoStations(
            Station(context, "Горячий цех", 1),
            Station(context, "Холодный цех", 2),
            Station(context, "Бар", 3));
    }

    private static DiningArea Area(DemoContext context, string name, int sortOrder)
    {
        var area = new DiningArea
        {
            OrganizationId = context.OrganizationId,
            BranchId = context.BranchId,
            Name = name,
            SortOrder = sortOrder,
        };
        context.Db.DiningAreas.Add(area);
        return area;
    }

    private static KitchenStation Station(DemoContext context, string name, int sortOrder)
    {
        var station = new KitchenStation
        {
            OrganizationId = context.OrganizationId,
            BranchId = context.BranchId,
            Name = name,
            SortOrder = sortOrder,
        };
        context.Db.KitchenStations.Add(station);
        return station;
    }
}

using Microsoft.Extensions.DependencyInjection;
using Restaurant.Application.Features.Organizations.Common;
using Restaurant.Domain.Entities.Kitchen;
using Restaurant.Infrastructure.Persistence.Context;
using Restaurant.IntegrationTests.Infrastructure;

namespace Restaurant.IntegrationTests.Branches;

/// <summary>Multi-branch test data (F4): extra branches and kitchen stations of a test org, created directly in the DB.</summary>
internal static class BranchTestData
{
    public static async Task<Guid> AddBranchAsync(ApiFactory factory, TestOrg org, string name = "Филиал 2")
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var branch = scope.ServiceProvider.GetRequiredService<OrganizationProvisioner>().CreateBranch(org.OrganizationId, name);
        await db.SaveChangesAsync();
        return branch.Id;
    }

    public static async Task<Guid> AddStationAsync(ApiFactory factory, TestOrg org, Guid branchId, string name, int sortOrder)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var station = new KitchenStation { OrganizationId = org.OrganizationId, BranchId = branchId, Name = name, SortOrder = sortOrder };
        db.KitchenStations.Add(station);
        await db.SaveChangesAsync();
        return station.Id;
    }
}

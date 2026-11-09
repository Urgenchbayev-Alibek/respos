using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Restaurant.Application.Features.Platform.FeatureFlags;
using Restaurant.Domain.Entities.Saas;
using Restaurant.Domain.Enums;
using Restaurant.IntegrationTests.Infrastructure;

namespace Restaurant.IntegrationTests.Platform;

[Collection(ApiCollection.Name)]
public sealed class PlatformCatalogTests(ApiFactory factory) : PlatformTestBase(factory)
{
    [Fact]
    public async Task Plans_can_be_created_updated_and_listed_with_features()
    {
        var admin = await LoginAsNewPlatformAdminAsync();
        var code = $"p{Guid.NewGuid():N}"[..12];

        var created = await PostJsonAsync(admin, "/api/v1/platform/plans",
            new { code, name = "Pilot", maxBranches = 2, maxUsers = 15, isActive = true, features = new[] { "kds", "reports" } });
        created.StatusCode.Should().Be(HttpStatusCode.Created);
        var id = (await ReadJsonAsync(created)).GetProperty("id").GetGuid();
        (await PostJsonAsync(admin, "/api/v1/platform/plans", new { code, name = "Dup", maxBranches = 1, maxUsers = 1, isActive = true }))
            .StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await PostJsonAsync(admin, "/api/v1/platform/plans",
                new { code = code + "x", name = "Bad", maxBranches = 1, maxUsers = 1, isActive = true, features = new[] { "teleport" } }))
            .StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var updated = await admin.PutAsJsonAsync($"/api/v1/platform/plans/{id}",
            new { name = "Pilot+", maxBranches = 3, maxUsers = 20, isActive = false, features = new[] { "csv_export" } }, Json);
        var dto = await ReadJsonAsync(updated);
        dto.GetProperty("name").GetString().Should().Be("Pilot+");
        dto.GetProperty("features").EnumerateArray().Select(f => f.GetString()).Should().Equal("csv_export");

        var plans = await ReadJsonAsync(await admin.GetAsync("/api/v1/platform/plans"));
        plans.EnumerateArray().Select(p => p.GetProperty("code").GetString()).Should().Contain(["starter", "business", code]);
        (await ReadJsonAsync(await admin.GetAsync("/api/v1/platform/features"))).EnumerateArray()
            .Select(f => f.GetProperty("code").GetString()).Should().Contain("csv_export");
    }

    [Fact]
    public async Task Feature_flags_override_plan_features_org_flag_first_then_global()
    {
        var org = await CreateOrgWithUserAsync();
        var admin = await LoginAsNewPlatformAdminAsync();
        var feature = $"f{Guid.NewGuid():N}"[..12];
        await WithDbAsync(async (db, _) =>
        {
            db.Features.Add(new Feature { Code = feature, Name = "Test feature" });
            var business = await db.Plans.FirstAsync(p => p.Code == Plan.Business);
            db.PlanFeatures.Add(new PlanFeature { PlanId = business.Id, FeatureCode = feature });
            await db.SaveChangesAsync();
        });

        (await IsEnabledAsync(org.OrganizationId, feature)).Should().BeTrue("the business plan includes it");
        await SetFlagAsync(admin, null, feature, false);
        (await IsEnabledAsync(org.OrganizationId, feature)).Should().BeFalse("a global flag beats the plan");
        await SetFlagAsync(admin, org.OrganizationId, feature, true);
        (await IsEnabledAsync(org.OrganizationId, feature)).Should().BeTrue("an organization flag beats the global flag");

        var flags = await ReadJsonAsync(await admin.GetAsync($"/api/v1/platform/feature-flags?organizationId={org.OrganizationId}"));
        flags.EnumerateArray().Where(f => f.GetProperty("featureCode").GetString() == feature).Should().HaveCount(2);
        (await admin.PutAsJsonAsync("/api/v1/platform/feature-flags", new { featureCode = "nope", isEnabled = true }, Json))
            .StatusCode.Should().Be(HttpStatusCode.NotFound);

        await WithDbAsync(async (db, _) =>
        {
            db.FeatureFlags.RemoveRange(db.FeatureFlags.Where(f => f.FeatureCode == feature));
            await db.SaveChangesAsync();
        });
    }

    [Fact]
    public async Task Csv_export_is_blocked_when_the_feature_is_disabled_for_the_organization()
    {
        var org = await CreateOrgWithUserAsync();
        var admin = await LoginAsNewPlatformAdminAsync();
        await SetFlagAsync(admin, org.OrganizationId, "csv_export", false);
        var client = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);

        var response = await client.GetAsync("/api/v1/reports/sales/export?format=csv");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await ReadErrorCodeAsync(response)).Should().Be("feature.disabled");
    }

    [Fact]
    public async Task System_info_and_demo_requests_are_available_to_platform_admin()
    {
        var admin = await LoginAsNewPlatformAdminAsync();
        var system = await ReadJsonAsync(await admin.GetAsync("/api/v1/platform/system"));
        system.GetProperty("dbStatus").GetString().Should().Be("ok");
        system.GetProperty("environment").GetString().Should().Be("Testing");
        system.GetProperty("organizationsCount").GetInt32().Should().BeGreaterThan(0);
        system.GetProperty("uptime").GetInt64().Should().BeGreaterOrEqualTo(0);

        var restaurant = $"Demo {Guid.NewGuid():N}";
        Guid demoId = default;
        await WithDbAsync(async (db, _) =>
        {
            var demo = new DemoRequest { Name = "Али", Phone = "+998901234567", RestaurantName = restaurant, CreatedAt = DateTime.UtcNow };
            demoId = demo.Id;
            db.DemoRequests.Add(demo);
            await db.SaveChangesAsync();
        });

        var list = await ReadJsonAsync(await admin.GetAsync($"/api/v1/platform/demo-requests?search={restaurant}"));
        list.GetProperty("totalCount").GetInt32().Should().Be(1);
        var changed = await ReadJsonAsync(await PostJsonAsync(admin, $"/api/v1/platform/demo-requests/{demoId}/status", new { status = "contacted" }));
        changed.GetProperty("status").GetString().Should().Be("contacted");
        (await PostJsonAsync(admin, $"/api/v1/platform/demo-requests/{Guid.NewGuid()}/status", new { status = "closed" }))
            .StatusCode.Should().Be(HttpStatusCode.NotFound);
        await WithDbAsync(async (db, _) =>
            (await db.DemoRequests.FirstAsync(d => d.Id == demoId)).Status.Should().Be(DemoRequestStatus.Contacted));
    }

    private static async Task SetFlagAsync(HttpClient admin, Guid? organizationId, string featureCode, bool isEnabled)
    {
        var response = await admin.PutAsJsonAsync("/api/v1/platform/feature-flags", new { organizationId, featureCode, isEnabled }, Json);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    private async Task<bool> IsEnabledAsync(Guid organizationId, string featureCode)
    {
        var result = false;
        await WithDbAsync(async (_, sp) => result = await sp.GetRequiredService<IFeatureFlags>().IsEnabledAsync(organizationId, featureCode));
        return result;
    }
}

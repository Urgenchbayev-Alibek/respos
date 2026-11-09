using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Constants;
using Restaurant.IntegrationTests.Infrastructure;

namespace Restaurant.IntegrationTests.Platform;

/// <summary>
/// A platform admin who is also a member of an organization gets a token that carries <c>org</c>.
/// Platform endpoints must run without that tenant scope (no cross-tenant write rejection, no filtered aggregates).
/// </summary>
[Collection(ApiCollection.Name)]
public sealed class PlatformScopeTests(ApiFactory factory) : PlatformTestBase(factory)
{
    [Fact]
    public async Task Platform_admin_with_organization_in_token_creates_and_lists_other_organizations()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Owner);
        await WithDbAsync(async (db, _) =>
        {
            var user = await db.Users.IgnoreQueryFilters().SingleAsync(u => u.Id == org.User.Id);
            user.IsPlatformAdmin = true;
            await db.SaveChangesAsync();
        });
        var admin = await LoginAsAsync(org.User);
        var me = await ReadJsonAsync(await admin.GetAsync("/api/v1/auth/me"));
        me.GetProperty("currentOrganization").GetProperty("id").GetGuid().Should().Be(org.OrganizationId);

        var slug = $"scope-{Guid.NewGuid():N}"[..20];
        var created = await PostJsonAsync(admin, "/api/v1/platform/organizations", NewOrganizationRequest(slug, $"owner-{slug}@test.respos.uz"));

        created.StatusCode.Should().Be(HttpStatusCode.Created);
        var dto = await ReadJsonAsync(created);
        dto.GetProperty("branchesCount").GetInt32().Should().Be(1);
        dto.GetProperty("usersCount").GetInt32().Should().Be(1);

        var list = await ReadJsonAsync(await admin.GetAsync($"/api/v1/platform/organizations?search={slug}"));
        list.GetProperty("totalCount").GetInt32().Should().Be(1);
        list.GetProperty("items")[0].GetProperty("branchesCount").GetInt32().Should().Be(1);
    }

    [Fact]
    public async Task Organization_dto_exposes_subscription_end_date()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Owner);
        var admin = await LoginAsNewPlatformAdminAsync();
        var endsAt = DateTime.UtcNow.Date.AddDays(30);

        var response = await admin.PutAsJsonAsync($"/api/v1/platform/organizations/{org.OrganizationId}/subscription",
            new { planCode = "business", status = "active", endsAt }, Json);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await ReadJsonAsync(response);
        dto.GetProperty("subscriptionEndsAt").GetDateTime().Should().Be(endsAt);
    }
}

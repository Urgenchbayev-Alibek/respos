using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Features.Platform.Common;
using Restaurant.Domain.Constants;
using Restaurant.IntegrationTests.Infrastructure;

namespace Restaurant.IntegrationTests.Platform;

[Collection(ApiCollection.Name)]
public sealed class PlatformOrganizationsTests(ApiFactory factory) : PlatformTestBase(factory)
{
    [Theory]
    [InlineData("/api/v1/platform/organizations")]
    [InlineData("/api/v1/platform/plans")]
    [InlineData("/api/v1/platform/feature-flags")]
    [InlineData("/api/v1/platform/system")]
    [InlineData("/api/v1/platform/system-events")]
    [InlineData("/api/v1/platform/demo-requests")]
    public async Task Platform_endpoints_are_forbidden_for_organization_users(string url)
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Owner);
        var owner = await LoginAsAsync(org.User);

        var response = await owner.GetAsync(url);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await ReadErrorCodeAsync(response)).Should().Be("auth.forbidden");
    }

    [Fact]
    public async Task Platform_admin_creates_organization_whose_owner_can_log_in_and_it_is_audited()
    {
        var admin = await LoginAsNewPlatformAdminAsync();
        var slug = $"cafe-{Guid.NewGuid():N}"[..20];
        var ownerEmail = $"owner-{slug}@test.respos.uz";

        var created = await PostJsonAsync(admin, "/api/v1/platform/organizations", NewOrganizationRequest(slug, ownerEmail));

        created.StatusCode.Should().Be(HttpStatusCode.Created);
        var dto = await ReadJsonAsync(created);
        var orgId = dto.GetProperty("id").GetGuid();
        dto.GetProperty("planCode").GetString().Should().Be("business");
        dto.GetProperty("subscriptionStatus").GetString().Should().Be("active");
        dto.GetProperty("branchesCount").GetInt32().Should().Be(1);
        dto.GetProperty("usersCount").GetInt32().Should().Be(1);

        var owner = await LoginAsAsync(ownerEmail, "Owner1234");
        var me = await ReadJsonAsync(await owner.GetAsync("/api/v1/auth/me"));
        me.GetProperty("currentOrganization").GetProperty("id").GetGuid().Should().Be(orgId);
        me.GetProperty("roles").EnumerateArray().Select(r => r.GetString()).Should().Equal(SystemRoles.Owner);
        me.GetProperty("permissions").GetArrayLength().Should().Be(PermissionCatalog.OrganizationCodes.Count);
        (await owner.GetAsync("/api/v1/roles")).StatusCode.Should().Be(HttpStatusCode.OK);

        (await PostJsonAsync(admin, "/api/v1/platform/organizations", NewOrganizationRequest(slug, $"x{ownerEmail}")))
            .StatusCode.Should().Be(HttpStatusCode.Conflict);

        var list = await ReadJsonAsync(await admin.GetAsync($"/api/v1/platform/organizations?search={slug}"));
        list.GetProperty("totalCount").GetInt32().Should().Be(1);
        var row = list.GetProperty("items")[0];
        row.EnumerateObject().Select(p => p.Name).Should().BeEquivalentTo(
            "id", "name", "slug", "status", "planCode", "subscriptionStatus", "branchesCount", "usersCount", "createdAt", "isDemo",
            "subscriptionEndsAt");

        var events = await ReadJsonAsync(await admin.GetAsync("/api/v1/platform/system-events?action=platform.organization.created&pageSize=100"));
        events.GetProperty("items").EnumerateArray().Should().Contain(e => e.GetProperty("entityId").GetString() == orgId.ToString());
    }

    [Fact]
    public async Task Suspended_organization_cannot_log_in_and_loses_access_until_activated()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Owner);
        var ownerSession = await LoginAsAsync(org.User);
        var admin = await LoginAsNewPlatformAdminAsync();

        var suspended = await admin.PostAsync($"/api/v1/platform/organizations/{org.OrganizationId}/suspend", null);
        (await ReadJsonAsync(suspended)).GetProperty("status").GetString().Should().Be("suspended");

        var login = await CreateClient().PostAsJsonAsync("/api/v1/auth/login", new { email = org.User.Email, password = org.User.Password }, Json);
        login.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await ReadErrorCodeAsync(login)).Should().Be("organization.suspended");
        (await ownerSession.GetAsync("/api/v1/users")).StatusCode.Should().Be(HttpStatusCode.Forbidden);

        await admin.PostAsync($"/api/v1/platform/organizations/{org.OrganizationId}/activate", null);
        (await LoginAsAsync(org.User)).Should().NotBeNull();

        await WithDbAsync(async (db, _) =>
        {
            var actions = await db.AuditLogs.Where(a => a.OrganizationId == org.OrganizationId).Select(a => a.Action).ToListAsync();
            actions.Should().Contain([PlatformActions.OrganizationSuspended, PlatformActions.OrganizationActivated]);
        });
    }

    [Fact]
    public async Task Break_glass_requires_reason_is_audited_and_gives_a_read_only_token()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Owner);
        var admin = await LoginAsNewPlatformAdminAsync();
        var url = $"/api/v1/platform/organizations/{org.OrganizationId}/access";

        (await PostJsonAsync(admin, url, new { reason = "" })).StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var granted = await ReadJsonAsync(await PostJsonAsync(admin, url, new { reason = "Тикет #42: проверка отчёта" }));
        var expiresAt = granted.GetProperty("expiresAt").GetDateTime();
        expiresAt.Should().BeCloseTo(DateTime.UtcNow.AddMinutes(30), TimeSpan.FromMinutes(1));
        granted.GetProperty("permissions").EnumerateArray().Should().OnlyContain(p => p.GetString()!.EndsWith(".read"));

        var tenant = ClientWithBranch(ClientWithToken(granted.GetProperty("accessToken").GetString()!), org.BranchId);
        (await tenant.GetAsync("/api/v1/users")).StatusCode.Should().Be(HttpStatusCode.OK);
        (await tenant.GetAsync("/api/v1/dashboard")).StatusCode.Should().Be(HttpStatusCode.OK);
        (await tenant.GetAsync("/api/v1/audit-logs")).StatusCode.Should().Be(HttpStatusCode.OK);
        (await tenant.PostAsync("/api/v1/notifications/read-all", null)).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await PostJsonAsync(tenant, "/api/v1/branches", new { name = "Hack" })).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await tenant.GetAsync("/api/v1/platform/organizations")).StatusCode.Should().Be(HttpStatusCode.Forbidden);

        var orgAudit = await ReadJsonAsync(await (await LoginAsAsync(org.User)).GetAsync(
            $"/api/v1/audit-logs?action={PlatformActions.TenantAccessGranted}"));
        var entry = orgAudit.GetProperty("items")[0];
        entry.GetProperty("changes").GetProperty("reason").GetString().Should().Be("Тикет #42: проверка отчёта");
        entry.GetProperty("userName").GetString().Should().Be("Platform Admin");
    }
}

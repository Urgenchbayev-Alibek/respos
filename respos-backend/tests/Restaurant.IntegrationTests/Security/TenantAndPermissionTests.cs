using System.Net;
using System.Net.Http.Json;
using Restaurant.IntegrationTests.Infrastructure;

namespace Restaurant.IntegrationTests.Security;

[Collection(ApiCollection.Name)]
public sealed class TenantAndPermissionTests(ApiFactory factory) : ApiTestBase(factory)
{
    [Fact]
    public async Task Missing_permission_returns_403()
    {
        var org = await CreateOrgWithUserAsync("waiter");
        var client = await LoginAsAsync(org.User);

        var response = await client.GetAsync("/api/v1/users");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await ReadErrorCodeAsync(response)).Should().Be("auth.forbidden");
    }

    [Fact]
    public async Task Org_level_endpoints_work_without_branch_header()
    {
        var org = await CreateOrgWithUserAsync();
        var client = await LoginAsAsync(org.User);

        foreach (var url in new[] { "/api/v1/users", "/api/v1/roles", "/api/v1/permissions", "/api/v1/branches", "/api/v1/organization" })
        {
            (await client.GetAsync(url)).StatusCode.Should().Be(HttpStatusCode.OK, url);
        }
    }

    [Fact]
    public async Task Organization_A_cannot_read_or_modify_organization_B_resources_by_id()
    {
        var orgA = await CreateOrgWithUserAsync();
        var orgB = await CreateOrgWithUserAsync();
        var client = await LoginAsAsync(orgA.User);
        var userB = orgB.User.Id;
        var branchB = orgB.BranchId;

        (await client.GetAsync($"/api/v1/users/{userB}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await client.PutAsJsonAsync($"/api/v1/users/{userB}", new { fullName = "Hacked", phone = (string?)null, roleIds = new[] { orgA.RoleIds["waiter"] }, branchIds = new[] { orgA.BranchId } }))
            .StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await client.PostAsync($"/api/v1/users/{userB}/block", null)).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await client.GetAsync($"/api/v1/branches/{branchB}/settings")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await client.PutAsJsonAsync($"/api/v1/branches/{branchB}", new { name = "Hacked", address = (string?)null, phone = (string?)null, timezone = "Asia/Tashkent" }))
            .StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await client.PutAsJsonAsync($"/api/v1/roles/{orgB.RoleIds["waiter"]}", new { name = "Hacked", permissions = new[] { "menu.read" } }))
            .StatusCode.Should().Be(HttpStatusCode.NotFound);

        var users = await ReadJsonAsync(await client.GetAsync("/api/v1/users?pageSize=100"));
        users.GetProperty("items").EnumerateArray().Select(u => u.GetProperty("id").GetGuid()).Should().NotContain(userB);
        var branches = await ReadJsonAsync(await client.GetAsync("/api/v1/branches"));
        branches.EnumerateArray().Select(b => b.GetProperty("id").GetGuid()).Should().Equal(orgA.BranchId);
    }

    [Fact]
    public async Task Organization_A_cannot_assign_organization_B_roles_or_branches()
    {
        var orgA = await CreateOrgWithUserAsync();
        var orgB = await CreateOrgWithUserAsync();
        var client = await LoginAsAsync(orgA.User);

        var response = await client.PostAsJsonAsync("/api/v1/users", new
        {
            email = $"new-{Guid.NewGuid():N}@test.respos.uz",
            fullName = "Новый сотрудник",
            password = ApiFactory.TestPassword,
            roleIds = new[] { orgB.RoleIds["waiter"] },
            branchIds = new[] { orgA.BranchId },
        });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await ReadErrorCodeAsync(response)).Should().Be("user.invalid_roles");
    }

    [Fact]
    public async Task Branch_header_missing_foreign_or_without_access_returns_403()
    {
        var orgA = await CreateOrgWithUserAsync("waiter");
        var orgB = await CreateOrgWithUserAsync();
        var client = await LoginAsAsync(orgA.User);

        (await client.GetAsync("/api/v1/test-probe/branch")).StatusCode.Should().Be(HttpStatusCode.Forbidden);

        ClientWithBranch(client, orgB.BranchId);
        var foreign = await client.GetAsync("/api/v1/test-probe/branch");
        foreign.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await ReadErrorCodeAsync(foreign)).Should().Be("tenant.branch_forbidden");

        ClientWithBranch(client, orgA.BranchId);
        var own = await client.GetAsync("/api/v1/test-probe/branch");
        own.StatusCode.Should().Be(HttpStatusCode.OK);
        (await ReadJsonAsync(own)).GetProperty("branchId").GetGuid().Should().Be(orgA.BranchId);
    }

    [Fact]
    public async Task Non_owner_needs_explicit_branch_access_but_owner_sees_all_branches()
    {
        var org = await CreateOrgWithUserAsync();
        var owner = await LoginAsAsync(org.User);
        var created = await owner.PostAsJsonAsync("/api/v1/branches", new { name = "Филиал 2", address = (string?)null, phone = (string?)null, timezone = "Asia/Tashkent" });
        created.StatusCode.Should().Be(HttpStatusCode.Created);
        var secondBranch = (await ReadJsonAsync(created)).GetProperty("id").GetGuid();
        var cook = await AddUserAsync(org, "cook", org.BranchId);

        var cookClient = ClientWithBranch(await LoginAsAsync(cook), secondBranch);
        (await cookClient.GetAsync("/api/v1/test-probe/branch")).StatusCode.Should().Be(HttpStatusCode.Forbidden);

        ClientWithBranch(owner, secondBranch);
        (await owner.GetAsync("/api/v1/test-probe/branch")).StatusCode.Should().Be(HttpStatusCode.OK);
    }
}

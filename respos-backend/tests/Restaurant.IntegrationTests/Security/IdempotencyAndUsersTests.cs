using System.Net;
using System.Net.Http.Json;
using Restaurant.IntegrationTests.Infrastructure;

namespace Restaurant.IntegrationTests.Security;

[Collection(ApiCollection.Name)]
public sealed class IdempotencyTests(ApiFactory factory) : ApiTestBase(factory)
{
    private const string Url = "/api/v1/test-probe/idempotent";

    [Fact]
    public async Task Missing_key_is_rejected()
    {
        var org = await CreateOrgWithUserAsync();
        var client = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);

        var response = await client.PostAsJsonAsync(Url, new { value = "a" });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await ReadErrorCodeAsync(response)).Should().Be("idempotency.key_required");
    }

    [Fact]
    public async Task Same_key_replays_the_stored_response_and_different_body_is_rejected()
    {
        var org = await CreateOrgWithUserAsync();
        var client = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);
        var key = Guid.NewGuid().ToString();

        var first = await SendAsync(client, key, "a");
        var replay = await SendAsync(client, key, "a");
        var mismatch = await SendAsync(client, key, "b");

        first.StatusCode.Should().Be(HttpStatusCode.Created);
        replay.StatusCode.Should().Be(HttpStatusCode.Created);
        replay.Headers.GetValues("Idempotent-Replayed").Should().Equal("true");
        (await ReadJsonAsync(replay)).GetProperty("id").GetGuid()
            .Should().Be((await ReadJsonAsync(first)).GetProperty("id").GetGuid());
        mismatch.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        (await ReadErrorCodeAsync(mismatch)).Should().Be("idempotency.key_reused");
    }

    [Fact]
    public async Task Keys_are_scoped_per_user()
    {
        var org = await CreateOrgWithUserAsync();
        var other = await AddUserAsync(org, "manager");
        var key = Guid.NewGuid().ToString();

        var first = await SendAsync(ClientWithBranch(await LoginAsAsync(org.User), org.BranchId), key, "a");
        var second = await SendAsync(ClientWithBranch(await LoginAsAsync(other), org.BranchId), key, "a");

        second.Headers.Contains("Idempotent-Replayed").Should().BeFalse();
        (await ReadJsonAsync(second)).GetProperty("id").GetGuid()
            .Should().NotBe((await ReadJsonAsync(first)).GetProperty("id").GetGuid());
    }

    private static Task<HttpResponseMessage> SendAsync(HttpClient client, string key, string value)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, Url) { Content = JsonContent.Create(new { value }) };
        request.Headers.Add("Idempotency-Key", key);
        return client.SendAsync(request);
    }
}

[Collection(ApiCollection.Name)]
public sealed class UserManagementTests(ApiFactory factory) : ApiTestBase(factory)
{
    [Fact]
    public async Task Owner_creates_user_who_can_then_log_in_and_see_assigned_branch()
    {
        var org = await CreateOrgWithUserAsync();
        var client = await LoginAsAsync(org.User);
        var email = $"cashier-{Guid.NewGuid():N}@test.respos.uz";

        var created = await client.PostAsJsonAsync("/api/v1/users", new
        {
            email, fullName = "Кассир Тест", password = "Kassa2026", roleIds = new[] { org.RoleIds["cashier"] }, branchIds = new[] { org.BranchId },
        });

        created.StatusCode.Should().Be(HttpStatusCode.Created);
        var me = await ReadJsonAsync(await (await LoginAsAsync(email, "Kassa2026")).GetAsync("/api/v1/auth/me"));
        me.GetProperty("roles").EnumerateArray().Select(r => r.GetString()).Should().Equal("cashier");
        me.GetProperty("branches").EnumerateArray().Select(b => b.GetProperty("id").GetGuid()).Should().Equal(org.BranchId);
    }

    [Fact]
    public async Task Owner_cannot_block_self_and_blocked_user_cannot_log_in()
    {
        var org = await CreateOrgWithUserAsync();
        var waiter = await AddUserAsync(org, "waiter");
        var client = await LoginAsAsync(org.User);

        var self = await client.PostAsync($"/api/v1/users/{org.User.Id}/block", null);
        self.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);

        (await client.PostAsync($"/api/v1/users/{waiter.Id}/block", null)).StatusCode.Should().Be(HttpStatusCode.OK);
        var login = await CreateClient().PostAsJsonAsync("/api/v1/auth/login", new { email = waiter.Email, password = waiter.Password });
        login.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await ReadErrorCodeAsync(login)).Should().Be("auth.account_blocked");
    }

    [Fact]
    public async Task System_roles_are_protected_and_validation_errors_use_camel_case_keys()
    {
        var org = await CreateOrgWithUserAsync();
        var client = await LoginAsAsync(org.User);

        var update = await client.PutAsJsonAsync($"/api/v1/roles/{org.RoleIds["waiter"]}", new { name = "Waiter+", permissions = new[] { "menu.read" } });
        update.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        (await ReadErrorCodeAsync(update)).Should().Be("role.system_protected");

        var invalid = await client.PostAsJsonAsync("/api/v1/users", new
        {
            email = "not-an-email", fullName = "", password = "short", roleIds = Array.Empty<Guid>(), branchIds = Array.Empty<Guid>(),
        });
        invalid.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var errors = (await ReadJsonAsync(invalid)).GetProperty("errors");
        errors.TryGetProperty("email", out _).Should().BeTrue();
        errors.TryGetProperty("password", out _).Should().BeTrue();
    }
}

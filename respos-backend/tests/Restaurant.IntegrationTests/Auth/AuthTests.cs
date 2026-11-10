using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Restaurant.IntegrationTests.Infrastructure;

namespace Restaurant.IntegrationTests.Auth;

[Collection(ApiCollection.Name)]
public sealed class AuthTests(ApiFactory factory) : ApiTestBase(factory)
{
    private const string LoginUrl = "/api/v1/auth/login";
    private const string RefreshUrl = "/api/v1/auth/refresh";

    [Fact]
    public async Task Login_returns_token_me_and_httponly_refresh_cookie()
    {
        var org = await CreateOrgWithUserAsync();
        var client = Factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });

        var response = await client.PostAsJsonAsync(LoginUrl, new { email = org.User.Email, password = org.User.Password });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await ReadJsonAsync(response);
        body.GetProperty("accessToken").GetString().Should().NotBeNullOrEmpty();
        var user = body.GetProperty("user");
        user.GetProperty("currentOrganization").GetProperty("id").GetGuid().Should().Be(org.OrganizationId);
        user.GetProperty("roles").EnumerateArray().Select(r => r.GetString()).Should().Equal("owner");
        user.GetProperty("branches").GetArrayLength().Should().Be(1);
        var cookie = RefreshCookieHeader(response);
        cookie.Should().Contain("httponly").And.Contain("path=/api/v1/auth");
    }

    [Fact]
    public async Task Login_with_wrong_password_returns_401_invalid_credentials()
    {
        var org = await CreateOrgWithUserAsync();

        var response = await CreateClient().PostAsJsonAsync(LoginUrl, new { email = org.User.Email, password = "Wrong1234" });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await ReadErrorCodeAsync(response)).Should().Be("auth.invalid_credentials");
    }

    [Fact]
    public async Task Refresh_rotates_token_and_reuse_of_old_token_revokes_the_family()
    {
        var org = await CreateOrgWithUserAsync();
        var client = Factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });
        var login = await client.PostAsJsonAsync(LoginUrl, new { email = org.User.Email, password = org.User.Password });
        var first = RefreshCookieValue(login);

        var rotated = await PostWithCookieAsync(client, RefreshUrl, first);
        rotated.StatusCode.Should().Be(HttpStatusCode.OK);
        (await ReadJsonAsync(rotated)).GetProperty("user").GetProperty("id").GetGuid().Should().Be(org.User.Id);
        var second = RefreshCookieValue(rotated);
        second.Should().NotBe(first);

        Factory.Clock.Advance(TimeSpan.FromSeconds(16)); // past the reuse grace window (15 s, ADR-0003)
        try
        {
            var reuse = await PostWithCookieAsync(client, RefreshUrl, first);
            reuse.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
            (await ReadErrorCodeAsync(reuse)).Should().Be("auth.refresh_token_reused");

            var afterReuse = await PostWithCookieAsync(client, RefreshUrl, second);
            afterReuse.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        }
        finally
        {
            Factory.Clock.Reset();
        }
    }

    [Fact]
    public async Task Logout_revokes_refresh_token()
    {
        var org = await CreateOrgWithUserAsync();
        var client = Factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });
        var login = await client.PostAsJsonAsync(LoginUrl, new { email = org.User.Email, password = org.User.Password });
        var token = RefreshCookieValue(login);

        (await PostWithCookieAsync(client, "/api/v1/auth/logout", token)).StatusCode.Should().Be(HttpStatusCode.NoContent);

        (await PostWithCookieAsync(client, RefreshUrl, token)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Login_is_rate_limited_per_ip_and_email()
    {
        var email = $"nobody-{Guid.NewGuid():N}@test.respos.uz";
        var client = CreateClient();
        for (var i = 0; i < 5; i++)
        {
            (await client.PostAsJsonAsync(LoginUrl, new { email, password = "Wrong1234" })).StatusCode
                .Should().Be(HttpStatusCode.Unauthorized);
        }

        var limited = await client.PostAsJsonAsync(LoginUrl, new { email, password = "Wrong1234" });

        limited.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
        (await ReadErrorCodeAsync(limited)).Should().Be("rate_limit.exceeded");
    }

    [Fact]
    public async Task Forgot_password_does_not_disclose_account_existence()
    {
        var org = await CreateOrgWithUserAsync();
        var client = CreateClient();

        var known = await client.PostAsJsonAsync("/api/v1/auth/forgot-password", new { email = org.User.Email });
        var unknown = await client.PostAsJsonAsync("/api/v1/auth/forgot-password", new { email = $"x-{Guid.NewGuid():N}@nowhere.uz" });

        known.StatusCode.Should().Be(HttpStatusCode.Accepted);
        unknown.StatusCode.Should().Be(HttpStatusCode.Accepted);
        (await known.Content.ReadAsStringAsync()).Should().Be(await unknown.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Me_requires_authentication_and_returns_permissions()
    {
        (await CreateClient().GetAsync("/api/v1/auth/me")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        var org = await CreateOrgWithUserAsync("waiter");
        var client = await LoginAsAsync(org.User);
        var me = await ReadJsonAsync(await client.GetAsync("/api/v1/auth/me"));

        me.GetProperty("permissions").EnumerateArray().Select(p => p.GetString())
            .Should().Contain("orders.create").And.NotContain("users.read");
    }

    [Fact]
    public async Task Platform_admin_can_login_without_organization()
    {
        var client = await LoginAsAsync(ApiFactory.PlatformAdminEmail);

        var me = await ReadJsonAsync(await client.GetAsync("/api/v1/auth/me"));

        me.GetProperty("isPlatformAdmin").GetBoolean().Should().BeTrue();
        me.GetProperty("permissions").EnumerateArray().Select(p => p.GetString()).Should().Contain("platform.organizations.read");
    }

    private static async Task<HttpResponseMessage> PostWithCookieAsync(HttpClient client, string url, string refreshToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Add("Cookie", $"refresh_token={refreshToken}");
        return await client.SendAsync(request);
    }

    private static string RefreshCookieHeader(HttpResponseMessage response) =>
        response.Headers.GetValues("Set-Cookie").Single(c => c.StartsWith("refresh_token=", StringComparison.Ordinal)).ToLowerInvariant();

    private static string RefreshCookieValue(HttpResponseMessage response) =>
        response.Headers.GetValues("Set-Cookie")
            .Single(c => c.StartsWith("refresh_token=", StringComparison.Ordinal))
            .Split(';')[0]["refresh_token=".Length..];
}

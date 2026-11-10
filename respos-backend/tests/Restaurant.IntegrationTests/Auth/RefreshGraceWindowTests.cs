using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Restaurant.Application.Abstractions.Security;
using Restaurant.Domain.Entities.Identity;
using Restaurant.IntegrationTests.Infrastructure;

namespace Restaurant.IntegrationTests.Auth;

/// <summary>
/// Refresh-token reuse grace window (ADR-0003): a token rotated less than Auth:RefreshReuseGraceSeconds (15 s) ago
/// is a benign race (two tabs / a retry) → 200 on the current chain, family kept. Later → reuse → family revoked.
/// </summary>
[Collection(ApiCollection.Name)]
public sealed class RefreshGraceWindowTests(ApiFactory factory) : ApiTestBase(factory)
{
    private const string LoginUrl = "/api/v1/auth/login";
    private const string RefreshUrl = "/api/v1/auth/refresh";
    private const string LogoutUrl = "/api/v1/auth/logout";

    [Fact]
    public async Task Reuse_within_grace_window_returns_200_and_keeps_the_family_alive()
    {
        var (client, first) = await LoginAsync();
        var rotated = await PostWithCookieAsync(client, RefreshUrl, first);
        rotated.StatusCode.Should().Be(HttpStatusCode.OK);
        var second = RefreshCookieValue(rotated);

        Factory.Clock.Advance(TimeSpan.FromSeconds(10));
        try
        {
            var raced = await PostWithCookieAsync(client, RefreshUrl, first);
            raced.StatusCode.Should().Be(HttpStatusCode.OK);
            (await ReadJsonAsync(raced)).GetProperty("accessToken").GetString().Should().NotBeNullOrEmpty();
            var third = RefreshCookieValue(raced);
            third.Should().NotBe(first).And.NotBe(second);

            var next = await PostWithCookieAsync(client, RefreshUrl, third);
            next.StatusCode.Should().Be(HttpStatusCode.OK);

            var family = await LoadFamilyAsync(first);
            family.Should().HaveCount(4);
            family.Count(t => t.RevokedAt == null).Should().Be(1, "one live chain tip");
            family.Where(t => t.RevokedAt != null).Should().OnlyContain(t => t.ReplacedByTokenId != null, "family not revoked");
        }
        finally
        {
            Factory.Clock.Reset();
        }
    }

    [Fact]
    public async Task Reuse_after_grace_window_returns_401_and_revokes_the_family()
    {
        var (client, first) = await LoginAsync();
        var rotated = await PostWithCookieAsync(client, RefreshUrl, first);
        rotated.StatusCode.Should().Be(HttpStatusCode.OK);
        var second = RefreshCookieValue(rotated);

        Factory.Clock.Advance(TimeSpan.FromSeconds(16));
        try
        {
            var reuse = await PostWithCookieAsync(client, RefreshUrl, first);
            reuse.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
            (await ReadErrorCodeAsync(reuse)).Should().Be("auth.refresh_token_reused");

            (await PostWithCookieAsync(client, RefreshUrl, second)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
            (await LoadFamilyAsync(first)).Should().OnlyContain(t => t.RevokedAt != null);
        }
        finally
        {
            Factory.Clock.Reset();
        }
    }

    [Fact]
    public async Task Reuse_within_window_after_successor_was_revoked_still_revokes_the_family()
    {
        var (client, first) = await LoginAsync();
        var second = RefreshCookieValue(await PostWithCookieAsync(client, RefreshUrl, first));
        (await PostWithCookieAsync(client, LogoutUrl, second)).IsSuccessStatusCode.Should().BeTrue();

        var reuse = await PostWithCookieAsync(client, RefreshUrl, first);
        reuse.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await ReadErrorCodeAsync(reuse)).Should().Be("auth.refresh_token_reused");
    }

    [Fact]
    public async Task Parallel_refreshes_of_one_cookie_all_succeed_without_forking_or_revoking_the_family()
    {
        var (client, first) = await LoginAsync();

        var responses = await Task.WhenAll(Enumerable.Range(0, 4).Select(_ => PostWithCookieAsync(client, RefreshUrl, first)));

        responses.Select(r => r.StatusCode).Should().AllBeEquivalentTo(HttpStatusCode.OK);
        var family = await LoadFamilyAsync(first);
        family.Should().HaveCount(5, "login + one rotation per request, no orphan children");
        family.Count(t => t.RevokedAt == null).Should().Be(1, "rotation is atomic: one chain, no forks");
        family.Where(t => t.RevokedAt != null).Should().OnlyContain(t => t.ReplacedByTokenId != null, "family not revoked");
        family.Where(t => t.ReplacedByTokenId != null).Select(t => t.ReplacedByTokenId).Should().OnlyHaveUniqueItems();

        // The chain tip was returned to one of the callers and keeps working.
        var tip = family.Single(t => t.RevokedAt == null);
        var tipCookie = responses.Select(RefreshCookieValue).Single(raw => Hash(raw) == tip.TokenHash);
        (await PostWithCookieAsync(client, RefreshUrl, tipCookie)).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    private async Task<(HttpClient Client, string Cookie)> LoginAsync()
    {
        var org = await CreateOrgWithUserAsync();
        var client = Factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });
        var login = await client.PostAsJsonAsync(LoginUrl, new { email = org.User.Email, password = org.User.Password });
        login.EnsureSuccessStatusCode();
        return (client, RefreshCookieValue(login));
    }

    private async Task<List<RefreshToken>> LoadFamilyAsync(string anyRawTokenOfFamily)
    {
        var hash = Hash(anyRawTokenOfFamily);
        List<RefreshToken> family = [];
        await WithDbAsync(async (db, _) =>
        {
            var familyId = await db.RefreshTokens.Where(t => t.TokenHash == hash).Select(t => t.FamilyId).SingleAsync();
            family = await db.RefreshTokens.AsNoTracking().Where(t => t.FamilyId == familyId).ToListAsync();
        });
        return family;
    }

    private string Hash(string raw)
    {
        using var scope = Factory.Services.CreateScope();
        return scope.ServiceProvider.GetRequiredService<ISecureTokenGenerator>().Hash(raw);
    }

    private static async Task<HttpResponseMessage> PostWithCookieAsync(HttpClient client, string url, string refreshToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Add("Cookie", $"refresh_token={refreshToken}");
        return await client.SendAsync(request);
    }

    private static string RefreshCookieValue(HttpResponseMessage response) =>
        response.Headers.GetValues("Set-Cookie")
            .Single(c => c.StartsWith("refresh_token=", StringComparison.Ordinal))
            .Split(';')[0]["refresh_token=".Length..];
}

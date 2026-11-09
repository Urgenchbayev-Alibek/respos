using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using Restaurant.Application.Abstractions.Security;
using Restaurant.Domain.Entities.Identity;
using Restaurant.IntegrationTests.Infrastructure;

namespace Restaurant.IntegrationTests.Platform;

/// <summary>Platform tests use their own platform admin per test (the seeded one is login-rate-limited to 5/min).</summary>
public abstract class PlatformTestBase(ApiFactory factory) : ApiTestBase(factory)
{
    protected async Task<HttpClient> LoginAsNewPlatformAdminAsync()
    {
        var email = $"platform-{Guid.NewGuid():N}@test.respos.uz";
        await WithDbAsync(async (db, sp) =>
        {
            var admin = new User
            {
                FullName = "Platform Admin",
                IsPlatformAdmin = true,
                PasswordHash = sp.GetRequiredService<IPasswordHasher>().Hash(ApiFactory.TestPassword),
            };
            admin.SetEmail(email);
            db.Users.Add(admin);
            await db.SaveChangesAsync();
        });
        return await LoginAsAsync(email);
    }

    protected HttpClient ClientWithToken(string token)
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    protected static object NewOrganizationRequest(string slug, string ownerEmail) => new
    {
        name = $"Кафе {slug}",
        slug,
        currency = "UZS",
        ownerEmail,
        ownerFullName = "Новый Владелец",
        ownerPassword = "Owner1234",
        planCode = "business",
        branchName = "Центр",
    };

    protected static async Task<HttpResponseMessage> PostJsonAsync(HttpClient client, string url, object body) =>
        await client.PostAsJsonAsync(url, body, Json);
}

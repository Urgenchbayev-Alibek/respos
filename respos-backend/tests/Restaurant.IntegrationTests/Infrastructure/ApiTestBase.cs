using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Restaurant.Api.Extensions;
using Restaurant.Application.Abstractions.Security;
using Restaurant.Application.Features.Organizations.Common;
using Restaurant.Domain.Constants;
using Restaurant.Domain.Entities.Identity;
using Restaurant.Infrastructure.Persistence.Context;

namespace Restaurant.IntegrationTests.Infrastructure;

public sealed record TestUser(Guid Id, string Email, string Password, string RoleCode);

public sealed record TestOrg(Guid OrganizationId, Guid BranchId, TestUser User, IReadOnlyDictionary<string, Guid> RoleIds);

/// <summary>
/// Base class for API tests. Usage: <c>[Collection(ApiCollection.Name)] public class X(ApiFactory f) : ApiTestBase(f)</c>.
/// Every helper creates fresh, uniquely named data, so tests never interfere with each other.
/// </summary>
public abstract class ApiTestBase(ApiFactory factory)
{
    public static readonly JsonSerializerOptions Json = CreateJson();

    protected ApiFactory Factory { get; } = factory;

    /// <summary>New org (branch, system roles, business plan, units) + one active user with <paramref name="roleCode"/>.</summary>
    protected async Task<TestOrg> CreateOrgWithUserAsync(string roleCode = SystemRoles.Owner)
    {
        var suffix = Guid.NewGuid().ToString("N")[..10];
        TestOrg? result = null;
        await WithDbAsync(async (db, services) =>
        {
            var provisioner = services.GetRequiredService<OrganizationProvisioner>();
            var org = await provisioner.CreateAsync(new NewOrganization($"Test Org {suffix}", $"test-{suffix}", "Main"), default);
            var user = NewUser(services, $"{roleCode}-{suffix}@test.respos.uz");
            db.Users.Add(user);
            provisioner.AddMember(org.Organization.Id, user, [org.Roles[roleCode]], [org.Branch.Id]);
            await db.SaveChangesAsync();
            result = new TestOrg(org.Organization.Id, org.Branch.Id,
                new TestUser(user.Id, user.Email, ApiFactory.TestPassword, roleCode),
                org.Roles.ToDictionary(r => r.Key, r => r.Value.Id));
        });
        return result!;
    }

    /// <summary>Adds an active user with <paramref name="roleCode"/> to an existing test org (branch access to <paramref name="branchIds"/> or the main branch).</summary>
    protected async Task<TestUser> AddUserAsync(TestOrg org, string roleCode, params Guid[] branchIds)
    {
        var email = $"{roleCode}-{Guid.NewGuid().ToString("N")[..12]}@test.respos.uz";
        TestUser? result = null;
        await WithDbAsync(async (db, services) =>
        {
            var provisioner = services.GetRequiredService<OrganizationProvisioner>();
            var user = NewUser(services, email);
            db.Users.Add(user);
            var role = await db.Roles.IgnoreQueryFilters().FirstAsync(r => r.Id == org.RoleIds[roleCode]);
            provisioner.AddMember(org.OrganizationId, user, [role], branchIds.Length > 0 ? branchIds : [org.BranchId]);
            await db.SaveChangesAsync();
            result = new TestUser(user.Id, user.Email, ApiFactory.TestPassword, roleCode);
        });
        return result!;
    }

    /// <summary>Anonymous client (cookies handled automatically — refresh cookie is kept).</summary>
    protected HttpClient CreateClient() =>
        Factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = true });

    /// <summary>Logs in and returns a client with the bearer token set.</summary>
    protected async Task<HttpClient> LoginAsAsync(string email, string password = ApiFactory.TestPassword, Guid? organizationId = null)
    {
        var client = CreateClient();
        var response = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password, organizationId }, Json);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(Json);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body.GetProperty("accessToken").GetString());
        return client;
    }

    protected Task<HttpClient> LoginAsAsync(TestUser user) => LoginAsAsync(user.Email, user.Password);

    /// <summary>Sets the X-Branch-Id header on the client (returns the same client).</summary>
    protected static HttpClient ClientWithBranch(HttpClient client, Guid branchId)
    {
        client.DefaultRequestHeaders.Remove("X-Branch-Id");
        client.DefaultRequestHeaders.Add("X-Branch-Id", branchId.ToString());
        return client;
    }

    /// <summary>Runs code against the database in a fresh scope (no tenant context → use IgnoreQueryFilters for tenant tables).</summary>
    protected async Task WithDbAsync(Func<AppDbContext, IServiceProvider, Task> action)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        await action(scope.ServiceProvider.GetRequiredService<AppDbContext>(), scope.ServiceProvider);
    }

    protected static async Task<JsonElement> ReadJsonAsync(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>(Json);

    protected static async Task<string?> ReadErrorCodeAsync(HttpResponseMessage response) =>
        (await ReadJsonAsync(response)).TryGetProperty("code", out var code) ? code.GetString() : null;

    private static User NewUser(IServiceProvider services, string email)
    {
        var user = new User { FullName = "Test User", PasswordHash = services.GetRequiredService<IPasswordHasher>().Hash(ApiFactory.TestPassword) };
        user.SetEmail(email);
        return user;
    }

    private static JsonSerializerOptions CreateJson()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        ServiceCollectionExtensions.ConfigureJson(options);
        return options;
    }
}

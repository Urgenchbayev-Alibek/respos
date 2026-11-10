using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Restaurant.Application.Abstractions.Security;
using Restaurant.Domain.Constants;
using Restaurant.Domain.Entities.Identity;
using Restaurant.Domain.Entities.Staff;
using Restaurant.IntegrationTests.Infrastructure;

namespace Restaurant.IntegrationTests.Staff;

/// <summary>F6 / ADR-0014: shared device registration + PIN quick login.</summary>
[Collection(ApiCollection.Name)]
public sealed class PinLoginTests(ApiFactory factory) : ApiTestBase(factory)
{
    private const string Auth = "/api/v1/auth";
    private const string Pin = "2580";

    [Fact]
    public async Task Pin_is_hashed_weak_pins_rejected_and_password_required()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Waiter);
        var waiter = await LoginAsAsync(org.User);

        (await ReadErrorCodeAsync(await waiter.PutAsJsonAsync($"{Auth}/pin", new { currentPassword = ApiFactory.TestPassword, pin = "1234" }, Json)))
            .Should().Be("validation.failed");
        (await ReadErrorCodeAsync(await waiter.PutAsJsonAsync($"{Auth}/pin", new { currentPassword = "wrong-pass1", pin = Pin }, Json)))
            .Should().Be("auth.invalid_current_password");

        var set = await waiter.PutAsJsonAsync($"{Auth}/pin", new { currentPassword = ApiFactory.TestPassword, pin = Pin }, Json);
        set.StatusCode.Should().Be(HttpStatusCode.OK);
        (await ReadJsonAsync(set)).GetProperty("hasPin").GetBoolean().Should().BeTrue();

        await WithDbAsync(async (db, sp) =>
        {
            var stored = await db.StaffPins.SingleAsync(p => p.UserId == org.User.Id);
            stored.PinHash.Should().NotContain(Pin);
            sp.GetRequiredService<IPasswordHasher>().Verify(stored.PinHash, Pin).Should().BeTrue();
        });
    }

    [Fact]
    public async Task Owner_admin_and_platform_admin_cannot_set_pin()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Owner);
        var admin = await AddUserAsync(org, SystemRoles.Admin);
        foreach (var user in new[] { org.User, admin })
        {
            var client = await LoginAsAsync(user);
            var response = await client.PutAsJsonAsync($"{Auth}/pin", new { currentPassword = ApiFactory.TestPassword, pin = Pin }, Json);
            response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
            (await ReadErrorCodeAsync(response)).Should().Be("pin.not_allowed");
        }

        var platform = await LoginAsAsync(ApiFactory.PlatformAdminEmail);
        (await ReadErrorCodeAsync(await platform.PutAsJsonAsync($"{Auth}/pin", new { currentPassword = ApiFactory.TestPassword, pin = Pin }, Json)))
            .Should().Be("pin.not_allowed");
    }

    [Fact]
    public async Task Pin_login_requires_a_registered_device()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Waiter);
        await SetPinAsync(org.User);
        var anonymous = CreateClient();
        var response = await anonymous.PostAsJsonAsync($"{Auth}/pin-login", new { userId = org.User.Id, pin = Pin }, Json);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await ReadErrorCodeAsync(response)).Should().Be("device.invalid");
        (await anonymous.GetAsync($"{Auth}/device/staff")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        var waiter = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);
        (await waiter.PostAsJsonAsync($"{Auth}/device/register", new { name = "Tablet" }, Json)).StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Pin_login_on_device_issues_branch_scoped_session_and_lists_only_eligible_staff()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Manager);
        var secondBranch = await AddBranchAsync(org);
        var waiterUser = await AddUserAsync(org, SystemRoles.Waiter, org.BranchId, secondBranch);
        var owner = await AddUserAsync(org, SystemRoles.Owner);
        await SetPinAsync(waiterUser);
        await WithDbAsync(async (db, sp) =>
        {
            // A PIN row for an owner (e.g. set before a role change) must never allow PIN login.
            db.StaffPins.Add(StaffPin.Create(owner.Id, sp.GetRequiredService<IPasswordHasher>().Hash(Pin), owner.Id, DateTime.UtcNow));
            await db.SaveChangesAsync();
        });
        var device = await RegisterDeviceAsync(org);

        var staff = await ReadJsonAsync(await device.GetAsync($"{Auth}/device/staff"));
        staff.EnumerateArray().Select(s => s.GetProperty("id").GetGuid()).Should().Equal(waiterUser.Id);
        staff[0].EnumerateObject().Select(p => p.Name).Should().BeEquivalentTo(["id", "fullName"]);
        (await ReadJsonAsync(await device.GetAsync($"{Auth}/device"))).GetProperty("branchId").GetGuid().Should().Be(org.BranchId);

        var ownerLogin = await device.PostAsJsonAsync($"{Auth}/pin-login", new { userId = owner.Id, pin = Pin }, Json);
        (await ReadErrorCodeAsync(ownerLogin)).Should().Be("pin.invalid");

        var login = await device.PostAsJsonAsync($"{Auth}/pin-login", new { userId = waiterUser.Id, pin = Pin }, Json);
        login.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await ReadJsonAsync(login);
        body.GetProperty("user").GetProperty("branches").EnumerateArray().Select(b => b.GetProperty("id").GetGuid())
            .Should().Equal(org.BranchId);

        var session = CreateClient();
        session.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body.GetProperty("accessToken").GetString());
        (await ClientWithBranch(session, org.BranchId).GetAsync("/api/v1/staff/time-clock/me")).StatusCode.Should().Be(HttpStatusCode.OK);
        var other = await ClientWithBranch(session, secondBranch).GetAsync("/api/v1/staff/time-clock/me");
        other.StatusCode.Should().Be(HttpStatusCode.Forbidden, "PIN session is bound to the device branch");

        // The PIN session refreshes on the device (device cookie present) …
        (await device.PostAsync($"{Auth}/refresh", null)).StatusCode.Should().Be(HttpStatusCode.OK);
        await WithDbAsync(async (db, _) =>
            (await db.AuditLogs.AnyAsync(a => a.Action == "auth.pin_login_succeeded" && a.UserId == waiterUser.Id)).Should().BeTrue());
    }

    [Fact]
    public async Task Wrong_pins_lock_the_user_and_are_audited()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Manager);
        var waiterUser = await AddUserAsync(org, SystemRoles.Waiter);
        await SetPinAsync(waiterUser);
        var device = await RegisterDeviceAsync(org);

        for (var i = 0; i < 5; i++)
        {
            var wrong = await device.PostAsJsonAsync($"{Auth}/pin-login", new { userId = waiterUser.Id, pin = "9999" }, Json);
            (await ReadErrorCodeAsync(wrong)).Should().Be("pin.invalid");
        }

        var locked = await device.PostAsJsonAsync($"{Auth}/pin-login", new { userId = waiterUser.Id, pin = Pin }, Json);
        locked.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await ReadErrorCodeAsync(locked)).Should().Be("pin.locked");

        await WithDbAsync(async (db, _) =>
            (await db.AuditLogs.AnyAsync(a => a.Action == "auth.pin_locked" && a.EntityId == waiterUser.Id.ToString())).Should().BeTrue());

        // A manager reset clears the PIN and the lockout.
        var manager = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);
        (await manager.DeleteAsync($"/api/v1/staff/members/{waiterUser.Id}/pin")).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await manager.PutAsJsonAsync($"/api/v1/staff/members/{waiterUser.Id}/pin", new { pin = "4826" }, Json))
            .StatusCode.Should().Be(HttpStatusCode.OK);
        (await device.PostAsJsonAsync($"{Auth}/pin-login", new { userId = waiterUser.Id, pin = "4826" }, Json))
            .StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Revoked_device_rejects_pin_login_and_ends_pin_sessions()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Manager);
        var waiterUser = await AddUserAsync(org, SystemRoles.Waiter);
        await SetPinAsync(waiterUser);
        var device = await RegisterDeviceAsync(org);
        (await device.PostAsJsonAsync($"{Auth}/pin-login", new { userId = waiterUser.Id, pin = Pin }, Json))
            .StatusCode.Should().Be(HttpStatusCode.OK);

        var manager = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);
        var devices = await ReadJsonAsync(await manager.GetAsync("/api/v1/staff/devices"));
        var deviceId = devices.EnumerateArray().Single().GetProperty("id").GetGuid();
        (await manager.PostAsync($"/api/v1/staff/devices/{deviceId}/revoke", null)).StatusCode.Should().Be(HttpStatusCode.OK);

        (await device.PostAsync($"{Auth}/refresh", null)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        var again = await device.PostAsJsonAsync($"{Auth}/pin-login", new { userId = waiterUser.Id, pin = Pin }, Json);
        again.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await ReadErrorCodeAsync(again)).Should().Be("device.invalid");

        // Another organization's manager cannot see or revoke this device.
        var other = await CreateOrgWithUserAsync(SystemRoles.Manager);
        var foreign = ClientWithBranch(await LoginAsAsync(other.User), other.BranchId);
        (await ReadJsonAsync(await foreign.GetAsync("/api/v1/staff/devices?includeRevoked=true"))).GetArrayLength().Should().Be(0);
        (await foreign.PostAsync($"/api/v1/staff/devices/{deviceId}/revoke", null)).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Pin_session_refresh_requires_the_device_cookie()
    {
        var org = await CreateOrgWithUserAsync(SystemRoles.Manager);
        var waiterUser = await AddUserAsync(org, SystemRoles.Waiter);
        await SetPinAsync(waiterUser);
        var device = await RegisterDeviceAsync(org);
        var login = await device.PostAsJsonAsync($"{Auth}/pin-login", new { userId = waiterUser.Id, pin = Pin }, Json);
        var refreshCookie = login.Headers.GetValues("Set-Cookie").Single(c => c.StartsWith("refresh_token=", StringComparison.Ordinal)).Split(';')[0];

        var stolen = Factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{Auth}/refresh");
        request.Headers.Add("Cookie", refreshCookie);
        (await stolen.SendAsync(request)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    private async Task SetPinAsync(TestUser user)
    {
        var client = await LoginAsAsync(user);
        var response = await client.PutAsJsonAsync($"{Auth}/pin", new { currentPassword = ApiFactory.TestPassword, pin = Pin }, Json);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    /// <summary>Manager registers the browser as a shared device; returns that client without a bearer (cookie only).</summary>
    private async Task<HttpClient> RegisterDeviceAsync(TestOrg org)
    {
        var client = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);
        var response = await client.PostAsJsonAsync($"{Auth}/device/register", new { name = "Tablet 1" }, Json);
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        response.Headers.GetValues("Set-Cookie").Should().Contain(c => c.StartsWith("device_token=") && c.Contains("httponly"));
        (await ReadJsonAsync(response)).TryGetProperty("rawToken", out _).Should().BeFalse();
        client.DefaultRequestHeaders.Authorization = null;
        client.DefaultRequestHeaders.Remove("X-Branch-Id");
        return client;
    }

    private async Task<Guid> AddBranchAsync(TestOrg org)
    {
        var id = Guid.Empty;
        await WithDbAsync(async (db, _) =>
        {
            var branch = new RestaurantBranch { OrganizationId = org.OrganizationId, Name = "Second" };
            db.Branches.Add(branch);
            await db.SaveChangesAsync();
            id = branch.Id;
        });
        return id;
    }
}

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Enums;
using Restaurant.IntegrationTests.Floor;
using Restaurant.IntegrationTests.Infrastructure;

namespace Restaurant.IntegrationTests.Integrations;

[Collection(ApiCollection.Name)]
public sealed class PublicReservationTests(ApiFactory factory) : ApiTestBase(factory)
{
    private static readonly TimeZoneInfo Tashkent = TimeZoneInfo.FindSystemTimeZoneById("Asia/Tashkent");

    private string BookingDate => DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(Factory.Clock.UtcNow, Tashkent)).AddDays(3).ToString("yyyy-MM-dd");

    private async Task<(TestOrg Org, HttpClient Owner)> SetupAsync(int tables = 1)
    {
        var org = await CreateOrgWithUserAsync();
        var owner = ClientWithBranch(await LoginAsAsync(org.User), org.BranchId);
        var area = await FloorApi.CreateAreaAsync(owner);
        for (var i = 1; i <= tables; i++)
        {
            (await FloorApi.PostTableAsync(owner, area, i.ToString(), capacity: 2 + i)).EnsureSuccessStatusCode();
        }

        return (org, owner);
    }

    /// <summary>Public routes are keyed by the branch slug (generated on branch creation, F3).</summary>
    private async Task<string> SlugAsync(Guid branchId)
    {
        var slug = string.Empty;
        await WithDbAsync(async (db, _) =>
            slug = await db.Branches.IgnoreQueryFilters().Where(b => b.Id == branchId).Select(b => b.Slug!).SingleAsync());
        return slug;
    }

    private async Task<HttpResponseMessage> BookAsync(Guid branchId, string time, string phone = "90 123 45 67", string? website = null, string? date = null) =>
        await CreateClient().PostAsJsonAsync($"/api/v1/public/branches/{await SlugAsync(branchId)}/reservations",
            new { date = date ?? BookingDate, time, guests = 2, name = "Гость", phone, comment = "Окно", website }, Json);

    private async Task<Dictionary<string, bool>> SlotsAsync(Guid branchId)
    {
        var body = await ReadJsonAsync(await CreateClient().GetAsync($"/api/v1/public/branches/{await SlugAsync(branchId)}/availability?date={BookingDate}&guests=2"));
        return body.GetProperty("slots").EnumerateArray().ToDictionary(s => s.GetProperty("time").GetString()!, s => s.GetProperty("available").GetBoolean());
    }

    [Fact]
    public async Task Booking_creates_pending_reservation_on_a_table_and_honors_overlap()
    {
        var (org, owner) = await SetupAsync();
        (await SlotsAsync(org.BranchId))["19:00"].Should().BeTrue();

        var created = await BookAsync(org.BranchId, "19:00");
        created.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await ReadJsonAsync(created);
        body.GetProperty("status").GetString().Should().Be("pending");
        var id = body.GetProperty("reservationId").GetGuid();

        var slots = await SlotsAsync(org.BranchId);
        slots["18:00"].Should().BeFalse("18:00–20:00 overlaps 19:00–21:00");
        slots["19:00"].Should().BeFalse();
        slots["20:30"].Should().BeFalse();
        slots["21:00"].Should().BeTrue("adjacent slot is free");

        var again = await BookAsync(org.BranchId, "19:30");
        again.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ReadErrorCodeAsync(again)).Should().Be("reservation.slot_unavailable");

        await WithDbAsync(async (db, _) =>
        {
            var reservation = await db.TableReservations.IgnoreQueryFilters().SingleAsync(r => r.Id == id);
            reservation.OrganizationId.Should().Be(org.OrganizationId);
            reservation.TableId.Should().NotBeNull();
            reservation.GuestPhone.Should().Be("+998901234567");
            reservation.Status.Should().Be(ReservationStatus.Pending);
            (await db.Notifications.IgnoreQueryFilters().AnyAsync(n => n.UserId == org.User.Id && n.Title == "Новая онлайн-бронь"))
                .Should().BeTrue();
        });

        var staff = await ReadJsonAsync(await owner.GetAsync($"/api/v1/reservations/availability?date={BookingDate}&guests=2"));
        var slot = staff.GetProperty("slots").EnumerateArray().Single(s => s.GetProperty("time").GetString() == "21:00");
        slot.GetProperty("freeTables")[0].GetProperty("number").GetString().Should().Be("1");
        staff.GetProperty("slots").EnumerateArray().Single(s => s.GetProperty("time").GetString() == "19:00")
            .GetProperty("freeTables").GetArrayLength().Should().Be(0);
    }

    [Fact]
    public async Task Online_reservation_alerts_the_owner_in_telegram()
    {
        var (org, owner) = await SetupAsync();
        await IntegrationsApiTests.PutTelegramAsync(owner);
        (await BookAsync(org.BranchId, "12:00")).StatusCode.Should().Be(HttpStatusCode.Created);
        await WithDbAsync(async (db, _) =>
            (await db.OutboundMessages.CountAsync(m => m.OrganizationId == org.OrganizationId && m.Kind == "online_reservation")).Should().Be(2));
    }

    [Fact]
    public async Task Honeypot_answers_like_success_but_stores_nothing()
    {
        var (org, _) = await SetupAsync();
        var response = await BookAsync(org.BranchId, "19:00", website: "http://spam");
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        (await ReadJsonAsync(response)).GetProperty("status").GetString().Should().Be("pending");
        await WithDbAsync(async (db, _) =>
            (await db.TableReservations.IgnoreQueryFilters().CountAsync(r => r.OrganizationId == org.OrganizationId)).Should().Be(0));
    }

    [Fact]
    public async Task Invalid_input_is_rejected()
    {
        var (org, _) = await SetupAsync();
        var phone = await BookAsync(org.BranchId, "19:00", phone: "abc");
        phone.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await ReadJsonAsync(phone)).GetProperty("errors").TryGetProperty("phone", out _).Should().BeTrue();

        var past = await BookAsync(org.BranchId, "19:00", date: "2020-01-01");
        (await ReadErrorCodeAsync(past)).Should().Be("reservation.invalid_date");
        (await ReadErrorCodeAsync(await BookAsync(org.BranchId, "19:10"))).Should().Be("reservation.invalid_time");
        (await ReadErrorCodeAsync(await BookAsync(org.BranchId, "03:00"))).Should().Be("reservation.invalid_time");
        var unknown = await CreateClient().PostAsJsonAsync("/api/v1/public/branches/no-such-branch/reservations",
            new { date = BookingDate, time = "19:00", guests = 2, name = "Гость", phone = "901234567" }, Json);
        unknown.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await ReadErrorCodeAsync(unknown)).Should().Be("branch.not_found");
    }

    [Fact]
    public async Task Bookings_are_rate_limited_per_ip_and_branch()
    {
        var (org, _) = await SetupAsync();
        for (var i = 0; i < 10; i++)
        {
            (await BookAsync(org.BranchId, "19:00", website: "bot")).StatusCode.Should().Be(HttpStatusCode.Created);
        }

        var limited = await BookAsync(org.BranchId, "19:00", website: "bot");
        limited.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
        (await ReadErrorCodeAsync(limited)).Should().Be("rate_limit.exceeded");

        var (other, _) = await SetupAsync();
        (await BookAsync(other.BranchId, "19:00", website: "bot")).StatusCode.Should().Be(HttpStatusCode.Created, "another branch has its own window");
    }

    [Fact]
    public async Task Public_availability_never_exposes_table_ids()
    {
        var (org, _) = await SetupAsync(tables: 2);
        var slug = await SlugAsync(org.BranchId);
        var text = await (await CreateClient().GetAsync($"/api/v1/public/branches/{slug.ToUpperInvariant()}/availability?date={BookingDate}&guests=2"))
            .Content.ReadAsStringAsync();
        var json = JsonDocument.Parse(text).RootElement;
        json.GetProperty("branchSlug").GetString().Should().Be(slug, "slugs are case-insensitive");
        text.Should().NotContain(org.BranchId.ToString(), "the public API never needs internal ids");
        var byId = await CreateClient().GetAsync($"/api/v1/public/branches/{org.BranchId}/availability?date={BookingDate}&guests=2");
        byId.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await ReadErrorCodeAsync(byId)).Should().Be("branch.not_found");
        json.GetProperty("slots")[0].EnumerateObject().Select(p => p.Name).Should().BeEquivalentTo("time", "startsAt", "available");
        text.Should().NotContain("freeTables");
    }
}

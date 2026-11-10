using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Security;
using Restaurant.Domain.Entities.Staff;
using Restaurant.Infrastructure.Persistence.Context;

namespace Restaurant.Infrastructure.Persistence.Seed.Demo;

/// <summary>
/// Development-only (F6): quick-login PINs for the demo waiter, cashier and cook so the shared-device lock screen
/// (<c>/device</c>) can be tried right away. Users that already have a PIN keep it (runs on existing dev DBs too).
/// The PINs are public demo values, documented in README — never seeded outside Development.
/// </summary>
internal sealed class DemoPinSeeder(
    IPasswordHasher hasher,
    IClock clock,
    IHostEnvironment environment,
    IOptions<SeedOptions> options,
    ILogger<DemoPinSeeder> logger) : IDataSeeder
{
    public static readonly IReadOnlyDictionary<string, string> Pins = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["waiter"] = "2580",
        ["cashier"] = "3690",
        ["cook"] = "1470",
    };

    public int Order => 120;

    public async Task SeedAsync(AppDbContext db, CancellationToken cancellationToken)
    {
        if (!SeedingRegistration.DemoSeedingAllowed(environment, options))
        {
            return;
        }

        var emails = Pins.Keys.Select(login => $"{login}@{DemoUsers.Domain}").ToList();
        var users = await db.Users
            .Where(u => emails.Contains(u.Email) && !db.StaffPins.Any(p => p.UserId == u.Id))
            .Select(u => new { u.Id, u.Email })
            .ToListAsync(cancellationToken);
        if (users.Count == 0)
        {
            return;
        }

        var now = clock.UtcNow;
        foreach (var user in users)
        {
            var pin = Pins[user.Email.Split('@')[0]];
            db.StaffPins.Add(StaffPin.Create(user.Id, hasher.Hash(pin), user.Id, now));
        }

        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Demo PINs seeded for {Count} user(s)", users.Count);
    }
}

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Restaurant.Application.Abstractions.Security;
using Restaurant.Domain.Entities.Identity;
using Restaurant.Domain.Enums;
using Restaurant.Infrastructure.Persistence.Context;

namespace Restaurant.Infrastructure.Persistence.Seed;

/// <summary>
/// Creates the platform admin (superadmin@respos.uz) once. Password: Seed:PlatformAdminPassword, or in Development
/// the demo password. Outside Development without a configured password the admin is not created. Never resets a password.
/// </summary>
internal sealed class PlatformAdminSeeder(
    IPasswordHasher hasher,
    IHostEnvironment environment,
    IOptions<SeedOptions> options,
    ILogger<PlatformAdminSeeder> logger) : IDataSeeder
{
    public const string Email = "superadmin@respos.uz";

    public int Order => 30;

    public async Task SeedAsync(AppDbContext db, CancellationToken cancellationToken)
    {
        if (await db.Users.AnyAsync(u => u.Email == Email, cancellationToken))
        {
            return;
        }

        var password = options.Value.PlatformAdminPassword;
        if (string.IsNullOrWhiteSpace(password) && environment.IsDevelopment())
        {
            password = options.Value.DemoPassword;
        }

        if (string.IsNullOrWhiteSpace(password))
        {
            logger.LogWarning("Platform admin {Email} was not created: Seed:PlatformAdminPassword is not configured", Email);
            return;
        }

        var admin = new User
        {
            FullName = "Platform Admin",
            IsPlatformAdmin = true,
            Status = UserStatus.Active,
            PasswordHash = hasher.Hash(password),
        };
        admin.SetEmail(Email);
        db.Users.Add(admin);
        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Platform admin {Email} created", Email);
    }
}

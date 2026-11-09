using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Restaurant.Domain.Entities.Audit;
using Restaurant.Domain.Entities.Identity;
using Restaurant.Domain.Entities.Notifications;
using Restaurant.Domain.Enums;
using Restaurant.Infrastructure.Housekeeping;
using Restaurant.IntegrationTests.Infrastructure;

namespace Restaurant.IntegrationTests.Hardening;

[Collection(ApiCollection.Name)]
public sealed class HousekeepingTests(ApiFactory factory) : ApiTestBase(factory)
{
    [Fact]
    public async Task Cleanup_deletes_stale_rows_and_keeps_fresh_ones()
    {
        var org = await CreateOrgWithUserAsync();
        var userId = org.User.Id;
        var now = DateTime.UtcNow;
        var stale = new List<Guid>();
        var fresh = new List<Guid>();

        await WithDbAsync(async (db, _) =>
        {
            void Add(object entity, Guid id, bool isStale)
            {
                db.Add(entity);
                (isStale ? stale : fresh).Add(id);
            }

            IdempotencyRecord Idem(DateTime createdAt) =>
                new() { Key = Guid.NewGuid().ToString("N"), UserId = userId, RequestHash = "h", CreatedAt = createdAt };
            RefreshToken Refresh(DateTime expiresAt, DateTime? revokedAt) => new()
            {
                UserId = userId, OrganizationId = org.OrganizationId, TokenHash = Guid.NewGuid().ToString("N"),
                FamilyId = Guid.NewGuid(), CreatedAt = now.AddDays(-60), ExpiresAt = expiresAt, RevokedAt = revokedAt,
            };
            PasswordResetToken Reset(DateTime expiresAt) =>
                new() { UserId = userId, TokenHash = Guid.NewGuid().ToString("N"), CreatedAt = expiresAt.AddHours(-1), ExpiresAt = expiresAt };
            UserInvitation Invite(DateTime expiresAt) => new()
            {
                OrganizationId = org.OrganizationId, UserId = userId, Email = "invite@test.respos.uz",
                TokenHash = Guid.NewGuid().ToString("N"), ExpiresAt = expiresAt,
            };
            Notification Note(DateTime createdAt, bool read)
            {
                var n = new Notification
                {
                    OrganizationId = org.OrganizationId, BranchId = org.BranchId, UserId = userId,
                    Type = NotificationType.System, Title = "t", CreatedAt = createdAt,
                };
                if (read)
                {
                    n.Reads.Add(new NotificationRead { NotificationId = n.Id, UserId = userId, ReadAt = createdAt.AddMinutes(1) });
                }

                return n;
            }

            var e1 = Idem(now.AddHours(-25)); Add(e1, e1.Id, true);
            var e2 = Idem(now.AddHours(-1)); Add(e2, e2.Id, false);
            var r1 = Refresh(now.AddDays(-31), null); Add(r1, r1.Id, true);
            var r2 = Refresh(now.AddDays(5), now.AddDays(-31)); Add(r2, r2.Id, true);
            var r3 = Refresh(now.AddDays(-29), null); Add(r3, r3.Id, false);
            var r4 = Refresh(now.AddDays(5), now.AddDays(-2)); Add(r4, r4.Id, false);
            var p1 = Reset(now.AddDays(-31)); Add(p1, p1.Id, true);
            var p2 = Reset(now.AddDays(-1)); Add(p2, p2.Id, false);
            var i1 = Invite(now.AddDays(-31)); Add(i1, i1.Id, true);
            var i2 = Invite(now.AddDays(3)); Add(i2, i2.Id, false);
            var n1 = Note(now.AddDays(-91), read: true); Add(n1, n1.Id, true);
            var n2 = Note(now.AddDays(-91), read: false); Add(n2, n2.Id, false);
            var n3 = Note(now.AddDays(-10), read: true); Add(n3, n3.Id, false);
            await db.SaveChangesAsync();
        });

        HousekeepingResult? result = null;
        await WithDbAsync(async (_, sp) => result = await sp.GetRequiredService<HousekeepingCleaner>().RunAsync());

        result!.IdempotencyRecords.Should().BeGreaterThanOrEqualTo(1);
        result.RefreshTokens.Should().BeGreaterThanOrEqualTo(2);
        result.PasswordResetTokens.Should().BeGreaterThanOrEqualTo(1);
        result.Invitations.Should().BeGreaterThanOrEqualTo(1);
        result.Notifications.Should().BeGreaterThanOrEqualTo(1);
        await WithDbAsync(async (db, _) =>
        {
            var all = stale.Concat(fresh).ToList();
            var remaining = new List<Guid>();
            remaining.AddRange(await db.IdempotencyRecords.IgnoreQueryFilters().Where(x => all.Contains(x.Id)).Select(x => x.Id).ToListAsync());
            remaining.AddRange(await db.RefreshTokens.IgnoreQueryFilters().Where(x => all.Contains(x.Id)).Select(x => x.Id).ToListAsync());
            remaining.AddRange(await db.PasswordResetTokens.IgnoreQueryFilters().Where(x => all.Contains(x.Id)).Select(x => x.Id).ToListAsync());
            remaining.AddRange(await db.UserInvitations.IgnoreQueryFilters().Where(x => all.Contains(x.Id)).Select(x => x.Id).ToListAsync());
            remaining.AddRange(await db.Notifications.IgnoreQueryFilters().Where(x => all.Contains(x.Id)).Select(x => x.Id).ToListAsync());
            remaining.Should().BeEquivalentTo(fresh);
            (await db.Set<NotificationRead>().CountAsync(r => stale.Contains(r.NotificationId))).Should().Be(0);
        });
    }
}

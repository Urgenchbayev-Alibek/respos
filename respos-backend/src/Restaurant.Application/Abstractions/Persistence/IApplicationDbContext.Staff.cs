using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Entities.Staff;

namespace Restaurant.Application.Abstractions.Persistence;

/// <summary>Staff module DbSets: time clock, schedule, shared devices and PIN quick login (F6).</summary>
public partial interface IApplicationDbContext
{
    DbSet<TimeEntry> TimeEntries { get; }
    DbSet<ShiftSchedule> ShiftSchedules { get; }
    DbSet<StaffDevice> StaffDevices { get; }
    DbSet<StaffPin> StaffPins { get; }
    DbSet<PinSession> PinSessions { get; }
}

using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Menu.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Menu;

namespace Restaurant.Application.Features.Menu.ModifierGroups;

public sealed class ListModifierGroupsHandler(ITenantContext tenant, MenuReadService reader)
    : IHandler<ListModifierGroupsQuery, IReadOnlyList<ModifierGroupDto>>
{
    public async Task<Result<IReadOnlyList<ModifierGroupDto>>> HandleAsync(ListModifierGroupsQuery request, CancellationToken cancellationToken)
    {
        tenant.RequireOrganizationId();
        var groups = await reader.GroupsWithOptions().Where(g => !g.IsArchived).OrderBy(g => g.Name).ToListAsync(cancellationToken);
        return groups.Select(MenuReadService.ToDto).ToList();
    }
}

/// <summary>
/// Create/update a group with its options. Options missing from the request are archived when orders used them,
/// otherwise removed.
/// </summary>
public sealed class SaveModifierGroupHandler(
    IApplicationDbContext db, ITenantContext tenant, MenuReadService reader, MenuUsageService usage, IClock clock, IAuditLogger audit)
    : IHandler<SaveModifierGroupCommand, ModifierGroupDto>
{
    public async Task<Result<ModifierGroupDto>> HandleAsync(SaveModifierGroupCommand request, CancellationToken cancellationToken)
    {
        tenant.RequireOrganizationId();
        ModifierGroup group;
        if (request.Id is { } id)
        {
            var existing = await reader.GroupsWithOptions(tracking: true).FirstOrDefaultAsync(g => g.Id == id && !g.IsArchived, cancellationToken);
            if (existing is null)
            {
                return MenuErrors.ModifierGroupNotFound;
            }

            group = existing;
        }
        else
        {
            group = new ModifierGroup();
            db.ModifierGroups.Add(group);
        }

        var current = group.Options.Where(o => !o.IsArchived).ToDictionary(o => o.Id);
        if (request.Options.Any(o => o.Id is { } optionId && !current.ContainsKey(optionId)))
        {
            return MenuErrors.InvalidOption;
        }

        group.Name = request.Name.Trim();
        group.MinSelect = request.MinSelect;
        group.MaxSelect = request.MaxSelect;
        group.IsRequired = request.IsRequired;

        var keep = request.Options.Where(o => o.Id != null).Select(o => o.Id!.Value).ToHashSet();
        foreach (var removed in current.Values.Where(o => !keep.Contains(o.Id)))
        {
            if (await usage.IsOptionUsedAsync(removed.Id, cancellationToken))
            {
                removed.Archive(clock.UtcNow);
            }
            else
            {
                db.ModifierOptions.Remove(removed);
            }
        }

        for (var index = 0; index < request.Options.Count; index++)
        {
            var input = request.Options[index];
            var option = input.Id is { } optionId ? current[optionId] : new ModifierOption { GroupId = group.Id };
            option.Name = input.Name.Trim();
            option.PriceDelta = input.PriceDelta;
            option.SortOrder = index;
            if (input.Id is null)
            {
                db.ModifierOptions.Add(option);
            }
        }

        audit.Log(request.Id is null ? "modifier_group.created" : "modifier_group.updated", nameof(ModifierGroup), group.Id, request);
        await db.SaveChangesAsync(cancellationToken);
        var saved = await reader.GroupsWithOptions().FirstAsync(g => g.Id == group.Id, cancellationToken);
        return MenuReadService.ToDto(saved);
    }
}

/// <summary>DELETE: unlinks the group from menu items; archived when orders used its options, otherwise removed.</summary>
public sealed class DeleteModifierGroupHandler(
    IApplicationDbContext db, ITenantContext tenant, MenuUsageService usage, IClock clock, IAuditLogger audit)
    : IHandler<DeleteModifierGroupCommand, Unit>
{
    public async Task<Result<Unit>> HandleAsync(DeleteModifierGroupCommand request, CancellationToken cancellationToken)
    {
        tenant.RequireOrganizationId();
        var group = await db.ModifierGroups.Include(g => g.Options)
            .FirstOrDefaultAsync(g => g.Id == request.Id && !g.IsArchived, cancellationToken);
        if (group is null)
        {
            return MenuErrors.ModifierGroupNotFound;
        }

        var links = await db.MenuItemModifierGroups.Where(l => l.ModifierGroupId == group.Id).ToListAsync(cancellationToken);
        db.MenuItemModifierGroups.RemoveRange(links);
        var used = await usage.IsGroupUsedAsync(group.Id, cancellationToken);
        if (used)
        {
            group.Archive(clock.UtcNow);
        }
        else
        {
            db.ModifierGroups.Remove(group);
        }

        audit.Log(used ? "modifier_group.archived" : "modifier_group.deleted", nameof(ModifierGroup), group.Id, new { group.Name });
        await db.SaveChangesAsync(cancellationToken);
        return Unit.Value;
    }
}

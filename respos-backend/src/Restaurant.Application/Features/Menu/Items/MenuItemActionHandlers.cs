using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Files;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Menu.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Menu;

namespace Restaurant.Application.Features.Menu.Items;

/// <summary>Archives an item (never deleted: orders and recipes keep pointing at it). Idempotent.</summary>
public sealed class ArchiveMenuItemHandler(IApplicationDbContext db, ITenantContext tenant, IClock clock, IAuditLogger audit)
    : IHandler<ArchiveMenuItemCommand, Unit>
{
    public async Task<Result<Unit>> HandleAsync(ArchiveMenuItemCommand request, CancellationToken cancellationToken)
    {
        tenant.RequireOrganizationId();
        var item = await db.MenuItems.FirstOrDefaultAsync(i => i.Id == request.Id, cancellationToken);
        if (item is null)
        {
            return MenuErrors.ItemNotFound;
        }

        if (!item.IsArchived)
        {
            item.Archive(clock.UtcNow);
            audit.Log("menu_item.archived", nameof(MenuItem), item.Id, new { item.Name });
            await db.SaveChangesAsync(cancellationToken);
        }

        return Unit.Value;
    }
}

/// <summary>Stop-list toggle (<c>isAvailable</c>). Archived items cannot be made available (409).</summary>
public sealed class SetMenuItemAvailabilityHandler(IApplicationDbContext db, ITenantContext tenant, MenuReadService reader, IAuditLogger audit)
    : IHandler<SetMenuItemAvailabilityCommand, MenuItemDto>
{
    public async Task<Result<MenuItemDto>> HandleAsync(SetMenuItemAvailabilityCommand request, CancellationToken cancellationToken)
    {
        tenant.RequireOrganizationId();
        var item = await db.MenuItems.FirstOrDefaultAsync(i => i.Id == request.ItemId, cancellationToken);
        if (item is null)
        {
            return MenuErrors.ItemNotFound;
        }

        if (item.IsArchived)
        {
            return MenuErrors.ItemArchived;
        }

        if (item.IsAvailable != request.IsAvailable)
        {
            item.IsAvailable = request.IsAvailable;
            audit.Log("menu_item.availability_changed", nameof(MenuItem), item.Id, new { request.IsAvailable });
            await db.SaveChangesAsync(cancellationToken);
        }

        return (await reader.GetItemAsync(item.Id, cancellationToken))!;
    }
}

/// <summary>Stores a JPG/PNG/WEBP photo (≤ 2 MB, content sniffed) via <see cref="IFileStorage"/>; replaces the old file.</summary>
public sealed class UploadMenuItemPhotoHandler(IApplicationDbContext db, ITenantContext tenant, IFileStorage storage, IAuditLogger audit)
    : IHandler<UploadMenuItemPhotoCommand, MenuPhotoDto>
{
    public async Task<Result<MenuPhotoDto>> HandleAsync(UploadMenuItemPhotoCommand request, CancellationToken cancellationToken)
    {
        var orgId = tenant.RequireOrganizationId();
        var item = await db.MenuItems.FirstOrDefaultAsync(i => i.Id == request.ItemId, cancellationToken);
        if (item is null)
        {
            return MenuErrors.ItemNotFound;
        }

        if (item.IsArchived)
        {
            return MenuErrors.ItemArchived;
        }

        if (request.Length is <= 0 or > MenuPhotoRules.MaxBytes)
        {
            return MenuErrors.InvalidPhoto;
        }

        using var buffer = new MemoryStream();
        await request.Content.CopyToAsync(buffer, cancellationToken);
        var format = MenuPhotoRules.Detect(buffer.GetBuffer().AsSpan(0, (int)buffer.Length), request.ContentType, request.FileName);
        if (format is null || buffer.Length > MenuPhotoRules.MaxBytes)
        {
            return MenuErrors.InvalidPhoto;
        }

        buffer.Position = 0;
        var url = await storage.SaveAsync(buffer, "photo" + format.Value.Extension, format.Value.ContentType, $"menu-{orgId:N}", cancellationToken);
        var previous = item.PhotoUrl;
        item.PhotoUrl = url;
        audit.Log("menu_item.photo_changed", nameof(MenuItem), item.Id, new { photoUrl = url });
        await db.SaveChangesAsync(cancellationToken);
        if (!string.IsNullOrEmpty(previous))
        {
            await storage.DeleteAsync(previous, cancellationToken);
        }

        return new MenuPhotoDto(url);
    }
}

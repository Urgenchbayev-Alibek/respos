using System.Text.Json.Serialization;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Branches.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Delivery;
using Restaurant.Domain.Entities.Identity;

namespace Restaurant.Application.Features.Delivery.Settings;

/// <summary>Public QR-menu slug + delivery fee of a branch.</summary>
public sealed record DeliverySettingsDto(Guid BranchId, string? Slug, decimal DeliveryFee);

public sealed record GetDeliverySettingsQuery(Guid BranchId);

public sealed record UpdateDeliverySettingsCommand(string Slug, decimal DeliveryFee)
{
    [JsonIgnore]
    public Guid BranchId { get; init; }
}

public sealed class UpdateDeliverySettingsValidator : AbstractValidator<UpdateDeliverySettingsCommand>
{
    public const decimal MaxFee = 100_000_000m;

    public UpdateDeliverySettingsValidator()
    {
        RuleFor(x => x.Slug).NotEmpty().Must(s => BranchSlug.IsValid(s?.Trim().ToLowerInvariant()))
            .WithMessage($"Use {BranchSlug.MinLength}-{BranchSlug.MaxLength} latin letters, digits and hyphens.");
        RuleFor(x => x.DeliveryFee).InclusiveBetween(0m, MaxFee).PrecisionScale(18, 2, true);
    }
}

/// <summary><c>GET /branches/{id}/delivery-settings</c> (org-level, like branch settings).</summary>
public sealed class GetDeliverySettingsHandler(IApplicationDbContext db, ITenantContext tenant)
    : IHandler<GetDeliverySettingsQuery, DeliverySettingsDto>
{
    public async Task<Result<DeliverySettingsDto>> HandleAsync(GetDeliverySettingsQuery request, CancellationToken cancellationToken)
    {
        tenant.RequireOrganizationId();
        var dto = await db.Branches.AsNoTracking()
            .Where(b => b.Id == request.BranchId)
            .Select(b => new DeliverySettingsDto(b.Id, b.Slug, b.Settings != null ? b.Settings.DeliveryFee : 0m))
            .FirstOrDefaultAsync(cancellationToken);
        return dto is null ? BranchErrors.NotFound : dto;
    }
}

/// <summary><c>PUT /branches/{id}/delivery-settings</c>: slug is globally unique (409 <c>branch.slug_taken</c>).</summary>
public sealed class UpdateDeliverySettingsHandler(IApplicationDbContext db, ITenantContext tenant, IAuditLogger audit)
    : IHandler<UpdateDeliverySettingsCommand, DeliverySettingsDto>
{
    public async Task<Result<DeliverySettingsDto>> HandleAsync(UpdateDeliverySettingsCommand request, CancellationToken cancellationToken)
    {
        tenant.RequireOrganizationId();
        var branch = await db.Branches.Include(b => b.Settings).FirstOrDefaultAsync(b => b.Id == request.BranchId, cancellationToken);
        if (branch?.Settings is null)
        {
            return BranchErrors.NotFound;
        }

        var slug = request.Slug.Trim().ToLowerInvariant();
        var taken = await db.Branches.IgnoreQueryFilters().AnyAsync(b => b.Slug == slug && b.Id != branch.Id, cancellationToken);
        if (taken)
        {
            return DeliveryErrors.SlugTaken;
        }

        var before = new { branch.Slug, branch.Settings.DeliveryFee };
        branch.Slug = slug;
        branch.Settings.DeliveryFee = request.DeliveryFee;
        audit.Log(new AuditEntry("branch.delivery_settings_updated", "branch", branch.Id.ToString(),
            new { before, after = new { branch.Slug, branch.Settings.DeliveryFee } }) { BranchId = branch.Id });
        await db.SaveChangesAsync(cancellationToken);
        return new DeliverySettingsDto(branch.Id, branch.Slug, branch.Settings.DeliveryFee);
    }
}

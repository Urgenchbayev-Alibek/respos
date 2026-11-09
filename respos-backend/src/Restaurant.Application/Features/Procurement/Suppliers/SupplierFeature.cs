using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Extensions;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Common.Models;
using Restaurant.Application.Common.Validation;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Procurement;

namespace Restaurant.Application.Features.Procurement.Suppliers;

public sealed record SupplierDto(
    Guid Id, string Name, string? ContactPerson, string? Phone, string? Email, string? Address, string? Inn, string? Notes, bool IsArchived)
{
    public static SupplierDto From(Supplier s) => new(s.Id, s.Name, s.ContactPerson, s.Phone, s.Email, s.Address, s.Inn, s.Notes, s.IsArchived);
}

public sealed record ListSuppliersQuery : PageQuery
{
    public bool IncludeArchived { get; init; }
}

public sealed record SaveSupplierCommand(
    string Name, string? ContactPerson, string? Phone, string? Email, string? Address, string? Inn, string? Notes)
{
    public Guid? Id { get; init; }
}

public sealed record ArchiveSupplierCommand(Guid Id);

public sealed class SaveSupplierValidator : AbstractValidator<SaveSupplierCommand>
{
    public SaveSupplierValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(CommonRules.NameMaxLength);
        RuleFor(x => x.ContactPerson).MaximumLength(CommonRules.NameMaxLength);
        RuleFor(x => x.Phone).ValidPhone();
        RuleFor(x => x.Email).MaximumLength(CommonRules.EmailMaxLength).EmailAddress().When(x => !string.IsNullOrWhiteSpace(x.Email));
        RuleFor(x => x.Address).MaximumLength(500);
        RuleFor(x => x.Inn).MaximumLength(32);
        RuleFor(x => x.Notes).MaximumLength(2000);
    }
}

public sealed class ListSuppliersHandler(IApplicationDbContext db, ITenantContext tenant)
    : IHandler<ListSuppliersQuery, PagedResult<SupplierDto>>
{
    public async Task<Result<PagedResult<SupplierDto>>> HandleAsync(ListSuppliersQuery request, CancellationToken cancellationToken)
    {
        tenant.RequireOrganizationId();
        var query = db.Suppliers.AsNoTracking().Where(s => request.IncludeArchived || !s.IsArchived);
        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var term = request.Search.Trim().ToLower();
            query = query.Where(s => s.Name.ToLower().Contains(term) || (s.Inn != null && s.Inn.Contains(term)) || (s.Phone != null && s.Phone.Contains(term)));
        }

        var page = await query.OrderBy(s => s.Name).ToPagedResultAsync(request, cancellationToken);
        return new PagedResult<SupplierDto>(page.Items.Select(SupplierDto.From).ToList(), page.Page, page.PageSize, page.TotalCount);
    }
}

public sealed class SaveSupplierHandler(IApplicationDbContext db, ITenantContext tenant, IAuditLogger audit)
    : IHandler<SaveSupplierCommand, SupplierDto>
{
    public async Task<Result<SupplierDto>> HandleAsync(SaveSupplierCommand request, CancellationToken cancellationToken)
    {
        var orgId = tenant.RequireOrganizationId();
        Supplier? supplier;
        if (request.Id is { } id)
        {
            supplier = await db.Suppliers.FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
            if (supplier is null)
            {
                return ProcurementErrors.SupplierNotFound;
            }
        }
        else
        {
            supplier = new Supplier { OrganizationId = orgId };
            db.Suppliers.Add(supplier);
        }

        supplier.Name = request.Name.Trim();
        supplier.ContactPerson = Clean(request.ContactPerson);
        supplier.Phone = Clean(request.Phone);
        supplier.Email = Clean(request.Email);
        supplier.Address = Clean(request.Address);
        supplier.Inn = Clean(request.Inn);
        supplier.Notes = Clean(request.Notes);
        audit.Log(request.Id is null ? "supplier.created" : "supplier.updated", nameof(Supplier), supplier.Id, new { supplier.Name, supplier.Inn });
        await db.SaveChangesAsync(cancellationToken);
        return SupplierDto.From(supplier);
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

/// <summary>Suppliers are never deleted (purchase history) — archive only (BR-14.5).</summary>
public sealed class ArchiveSupplierHandler(IApplicationDbContext db, IClock clock, IAuditLogger audit)
    : IHandler<ArchiveSupplierCommand, Unit>
{
    public async Task<Result<Unit>> HandleAsync(ArchiveSupplierCommand request, CancellationToken cancellationToken)
    {
        var supplier = await db.Suppliers.FirstOrDefaultAsync(s => s.Id == request.Id, cancellationToken);
        if (supplier is null)
        {
            return ProcurementErrors.SupplierNotFound;
        }

        supplier.Archive(clock.UtcNow);
        audit.Log("supplier.archived", nameof(Supplier), supplier.Id);
        await db.SaveChangesAsync(cancellationToken);
        return Unit.Value;
    }
}

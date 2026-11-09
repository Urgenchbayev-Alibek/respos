using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Abstractions.Security;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Common.Validation;
using Restaurant.Application.Features.Organizations.Common;
using Restaurant.Application.Features.Platform.Common;
using Restaurant.Application.Features.Users.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Constants;
using Restaurant.Domain.Entities.Identity;

namespace Restaurant.Application.Features.Platform.Organizations;

public sealed record CreatePlatformOrganizationCommand(
    string Name,
    string Slug,
    string? Currency,
    string OwnerEmail,
    string OwnerFullName,
    string OwnerPassword,
    string PlanCode,
    string BranchName);

public sealed class CreatePlatformOrganizationValidator : AbstractValidator<CreatePlatformOrganizationCommand>
{
    public CreatePlatformOrganizationValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(CommonRules.NameMaxLength);
        RuleFor(x => x.Slug).NotEmpty().Matches("^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])$")
            .WithMessage("Slug: 3–64 lowercase letters, digits or '-'.");
        RuleFor(x => x.Currency).Matches("^[A-Z]{3}$").When(x => !string.IsNullOrEmpty(x.Currency));
        RuleFor(x => x.OwnerEmail).ValidEmail();
        RuleFor(x => x.OwnerFullName).NotEmpty().MaximumLength(CommonRules.NameMaxLength);
        RuleFor(x => x.OwnerPassword).StrongPassword();
        RuleFor(x => x.PlanCode).NotEmpty().MaximumLength(32);
        RuleFor(x => x.BranchName).NotEmpty().MaximumLength(CommonRules.NameMaxLength);
    }
}

/// <summary>
/// <c>POST /platform/organizations</c>: org + branch (+ settings) + system roles with permissions + subscription + default units
/// (shared <see cref="OrganizationProvisioner"/>) + owner user — one SaveChanges = one transaction. Audited.
/// </summary>
public sealed class CreatePlatformOrganizationHandler(
    IApplicationDbContext db,
    OrganizationProvisioner provisioner,
    IPasswordHasher hasher,
    IAuditLogger audit) : IHandler<CreatePlatformOrganizationCommand, PlatformOrganizationDto>
{
    public async Task<Result<PlatformOrganizationDto>> HandleAsync(CreatePlatformOrganizationCommand request, CancellationToken cancellationToken)
    {
        var slug = request.Slug.Trim().ToLowerInvariant();
        var email = User.NormalizeEmail(request.OwnerEmail);
        if (await db.Organizations.AnyAsync(o => o.Slug == slug, cancellationToken))
        {
            return PlatformErrors.SlugTaken;
        }

        if (await db.Users.AnyAsync(u => u.Email == email, cancellationToken))
        {
            return UserErrors.EmailTaken;
        }

        if (!await db.Plans.AnyAsync(p => p.Code == request.PlanCode && p.IsActive, cancellationToken))
        {
            return PlatformErrors.PlanNotFound;
        }

        var currency = string.IsNullOrWhiteSpace(request.Currency) ? Organization.DefaultCurrency : request.Currency;
        var provisioned = await provisioner.CreateAsync(
            new NewOrganization(request.Name.Trim(), slug, request.BranchName.Trim(), request.PlanCode, currency), cancellationToken);
        var organizationId = provisioned.Organization.Id;

        var owner = new User { FullName = request.OwnerFullName.Trim(), PasswordHash = hasher.Hash(request.OwnerPassword) };
        owner.SetEmail(email);
        db.Users.Add(owner);
        provisioner.AddMember(organizationId, owner, [provisioned.Roles[SystemRoles.Owner]], [provisioned.Branch.Id]);

        audit.Log(new AuditEntry(PlatformActions.OrganizationCreated, nameof(Organization), organizationId.ToString(),
            new { request.Name, Slug = slug, request.PlanCode, OwnerUserId = owner.Id, BranchId = provisioned.Branch.Id })
        {
            OrganizationId = organizationId,
        });
        await db.SaveChangesAsync(cancellationToken);

        return await db.ProjectOrganizations(db.Organizations.Where(o => o.Id == organizationId)).FirstAsync(cancellationToken);
    }
}

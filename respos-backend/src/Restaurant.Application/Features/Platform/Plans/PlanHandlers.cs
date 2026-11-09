using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Common.Validation;
using Restaurant.Application.Features.Platform.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Saas;

namespace Restaurant.Application.Features.Platform.Plans;

public sealed record PlanDto(Guid Id, string Code, string Name, int MaxBranches, int MaxUsers, bool IsActive, IReadOnlyList<string> Features);

public sealed record FeatureDto(string Code, string Name);

public sealed record ListPlansQuery;

public sealed record ListFeaturesQuery;

/// <summary>Plan fields shared by create/update.</summary>
public abstract record PlanFields(string Name, int MaxBranches, int MaxUsers, bool IsActive, IReadOnlyList<string>? Features);

public sealed record CreatePlanCommand(string Code, string Name, int MaxBranches, int MaxUsers, bool IsActive, IReadOnlyList<string>? Features)
    : PlanFields(Name, MaxBranches, MaxUsers, IsActive, Features);

public sealed record UpdatePlanCommand(string Name, int MaxBranches, int MaxUsers, bool IsActive, IReadOnlyList<string>? Features)
    : PlanFields(Name, MaxBranches, MaxUsers, IsActive, Features)
{
    public Guid Id { get; init; }
}

internal static class PlanRules
{
    public static void Apply<T>(AbstractValidator<T> v)
        where T : PlanFields
    {
        v.RuleFor(x => x.Name).NotEmpty().MaximumLength(CommonRules.NameMaxLength);
        v.RuleFor(x => x.MaxBranches).InclusiveBetween(1, 10_000);
        v.RuleFor(x => x.MaxUsers).InclusiveBetween(1, 100_000);
    }
}

public sealed class CreatePlanValidator : AbstractValidator<CreatePlanCommand>
{
    public CreatePlanValidator()
    {
        PlanRules.Apply(this);
        RuleFor(x => x.Code).NotEmpty().Matches("^[a-z0-9_-]{2,32}$");
    }
}

public sealed class UpdatePlanValidator : AbstractValidator<UpdatePlanCommand>
{
    public UpdatePlanValidator() => PlanRules.Apply(this);
}

public sealed class ListPlansHandler(IApplicationDbContext db) : IHandler<ListPlansQuery, IReadOnlyList<PlanDto>>
{
    public async Task<Result<IReadOnlyList<PlanDto>>> HandleAsync(ListPlansQuery request, CancellationToken cancellationToken)
    {
        var plans = await db.Plans.AsNoTracking().Include(p => p.Features)
            .OrderBy(p => p.MaxBranches).ThenBy(p => p.Code)
            .ToListAsync(cancellationToken);
        IReadOnlyList<PlanDto> result = plans.Select(PlanWriter.ToDto).ToList();
        return Result.Success(result);
    }
}

public sealed class ListFeaturesHandler(IApplicationDbContext db) : IHandler<ListFeaturesQuery, IReadOnlyList<FeatureDto>>
{
    public async Task<Result<IReadOnlyList<FeatureDto>>> HandleAsync(ListFeaturesQuery request, CancellationToken cancellationToken)
    {
        IReadOnlyList<FeatureDto> result = await db.Features.AsNoTracking().OrderBy(f => f.Code)
            .Select(f => new FeatureDto(f.Code, f.Name))
            .ToListAsync(cancellationToken);
        return Result.Success(result);
    }
}

public sealed class CreatePlanHandler(IApplicationDbContext db, PlanWriter writer) : IHandler<CreatePlanCommand, PlanDto>
{
    public async Task<Result<PlanDto>> HandleAsync(CreatePlanCommand request, CancellationToken cancellationToken)
    {
        if (await db.Plans.AnyAsync(p => p.Code == request.Code, cancellationToken))
        {
            return PlatformErrors.PlanCodeTaken;
        }

        var plan = new Plan { Code = request.Code };
        db.Plans.Add(plan);
        return await writer.SaveAsync(plan, request, PlatformActions.PlanCreated, cancellationToken);
    }
}

public sealed class UpdatePlanHandler(IApplicationDbContext db, PlanWriter writer) : IHandler<UpdatePlanCommand, PlanDto>
{
    public async Task<Result<PlanDto>> HandleAsync(UpdatePlanCommand request, CancellationToken cancellationToken)
    {
        var plan = await db.Plans.Include(p => p.Features).FirstOrDefaultAsync(p => p.Id == request.Id, cancellationToken);
        if (plan is null)
        {
            return PlatformErrors.PlanNotFound;
        }

        return await writer.SaveAsync(plan, request, PlatformActions.PlanUpdated, cancellationToken);
    }
}

/// <summary>Applies plan fields + feature set, audits and saves.</summary>
[ScopedService]
public sealed class PlanWriter(IApplicationDbContext db, IAuditLogger audit)
{
    public static PlanDto ToDto(Plan p) => new(
        p.Id, p.Code, p.Name, p.MaxBranches, p.MaxUsers, p.IsActive, p.Features.Select(f => f.FeatureCode).Order().ToList());

    public async Task<Result<PlanDto>> SaveAsync(Plan plan, PlanFields fields, string action, CancellationToken ct)
    {
        var wanted = (fields.Features ?? []).Distinct(StringComparer.Ordinal).ToList();
        var known = await db.Features.Where(f => wanted.Contains(f.Code)).Select(f => f.Code).ToListAsync(ct);
        if (known.Count != wanted.Count)
        {
            return PlatformErrors.InvalidFeatures with
            {
                Details = new Dictionary<string, string[]> { ["features"] = wanted.Except(known).ToArray() },
            };
        }

        plan.Name = fields.Name.Trim();
        plan.MaxBranches = fields.MaxBranches;
        plan.MaxUsers = fields.MaxUsers;
        plan.IsActive = fields.IsActive;
        foreach (var removed in plan.Features.Where(f => !wanted.Contains(f.FeatureCode)).ToList())
        {
            plan.Features.Remove(removed);
        }

        foreach (var code in wanted.Where(c => plan.Features.All(f => f.FeatureCode != c)))
        {
            plan.Features.Add(new PlanFeature { PlanId = plan.Id, FeatureCode = code });
        }

        audit.Log(new AuditEntry(action, nameof(Plan), plan.Id.ToString(),
            new { plan.Code, plan.Name, plan.MaxBranches, plan.MaxUsers, plan.IsActive, Features = wanted }));
        await db.SaveChangesAsync(ct);
        return ToDto(plan);
    }
}

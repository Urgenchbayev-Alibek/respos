using FluentValidation;
using Restaurant.Application.Features.Floor.Common;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Floor.Tables;

/// <summary><c>GET /tables?areaId=&amp;status=</c>.</summary>
public sealed record ListTablesQuery
{
    public Guid? AreaId { get; init; }
    public TableStatus? Status { get; init; }
}

public sealed record SaveTableCommand(string Number, int Capacity, Guid AreaId, decimal? PosX, decimal? PosY, bool? IsActive)
{
    /// <summary>Null = create.</summary>
    public Guid? Id { get; init; }
}

public sealed record ArchiveTableCommand(Guid Id);

public sealed record SetTableStatusCommand(TableStatus Status)
{
    public Guid TableId { get; init; }
}

public sealed class SaveTableValidator : AbstractValidator<SaveTableCommand>
{
    public SaveTableValidator()
    {
        RuleFor(x => x.Number).NotEmpty().MaximumLength(FloorRules.NumberMaxLength);
        RuleFor(x => x.Capacity).InclusiveBetween(1, FloorRules.MaxCapacity);
        RuleFor(x => x.AreaId).NotEmpty();
        RuleFor(x => x.PosX).InclusiveBetween(-FloorRules.MaxPosition, FloorRules.MaxPosition);
        RuleFor(x => x.PosY).InclusiveBetween(-FloorRules.MaxPosition, FloorRules.MaxPosition);
    }
}

public sealed class SetTableStatusValidator : AbstractValidator<SetTableStatusCommand>
{
    public SetTableStatusValidator()
    {
        RuleFor(x => x.Status).Must(s => s is TableStatus.Available or TableStatus.Unavailable)
            .WithMessage("Only available or unavailable can be set manually.");
    }
}

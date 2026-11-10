using System.Text.Json.Serialization;
using FluentValidation;
using Restaurant.Application.Common.Extensions;
using Restaurant.Application.Common.Models;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Inventory.Transfers;

public sealed record StockTransferLineDto(
    Guid Id,
    Guid IngredientId,
    string IngredientName,
    decimal Quantity,
    Guid UnitId,
    string UnitCode,
    decimal BaseQuantity,
    string BaseUnitCode,
    decimal? UnitCost);

/// <summary><c>direction</c> is relative to the X-Branch-Id branch (outgoing = it is the source).</summary>
public sealed record StockTransferDto(
    Guid Id,
    int Number,
    Guid FromBranchId,
    string FromBranchName,
    Guid ToBranchId,
    string ToBranchName,
    StockTransferStatus Status,
    StockTransferDirection Direction,
    string? Comment,
    decimal TotalCost,
    int LineCount,
    DateTime CreatedAt,
    DateTime? SentAt,
    DateTime? ReceivedAt,
    DateTime? CancelledAt,
    IReadOnlyList<StockTransferLineDto> Lines);

/// <summary><c>GET /stock/transfers?status=&amp;direction=incoming|outgoing&amp;page=&amp;pageSize=</c> (number desc).</summary>
public sealed record ListStockTransfersQuery : PageQuery
{
    public string? Status { get; init; }
    public string? Direction { get; init; }
}

public sealed record GetStockTransferQuery(Guid Id);

public sealed record TransferLineInput(Guid IngredientId, decimal Quantity, Guid UnitId);

/// <summary>Create (Id null) or replace a draft. The source is always the X-Branch-Id branch.</summary>
public sealed record SaveStockTransferCommand(Guid ToBranchId, string? Comment, IReadOnlyList<TransferLineInput> Lines)
{
    [JsonIgnore]
    public Guid? Id { get; init; }
}

public sealed record StockTransferActionCommand(Guid Id);

public sealed class ListStockTransfersValidator : AbstractValidator<ListStockTransfersQuery>
{
    public ListStockTransfersValidator()
    {
        RuleFor(x => x.Status).Must(SnakeCaseEnum.IsValidOrEmpty<StockTransferStatus>).WithMessage("Unknown status.");
        RuleFor(x => x.Direction).Must(SnakeCaseEnum.IsValidOrEmpty<StockTransferDirection>).WithMessage("Unknown direction.");
    }
}

public sealed class SaveStockTransferValidator : AbstractValidator<SaveStockTransferCommand>
{
    public const int MaxLines = 200;

    public SaveStockTransferValidator()
    {
        RuleFor(x => x.ToBranchId).NotEmpty();
        RuleFor(x => x.Comment).MaximumLength(1000);
        RuleFor(x => x.Lines).NotEmpty().Must(l => l is null || l.Count <= MaxLines);
        RuleFor(x => x.Lines)
            .Must(l => l.Select(x => x.IngredientId).Distinct().Count() == l.Count)
            .When(x => x.Lines is not null)
            .WithMessage("Duplicate ingredients.");
        RuleForEach(x => x.Lines).ChildRules(line =>
        {
            line.RuleFor(l => l.IngredientId).NotEmpty();
            line.RuleFor(l => l.UnitId).NotEmpty();
            line.RuleFor(l => l.Quantity).GreaterThan(0).PrecisionScale(18, 3, true);
        });
    }
}

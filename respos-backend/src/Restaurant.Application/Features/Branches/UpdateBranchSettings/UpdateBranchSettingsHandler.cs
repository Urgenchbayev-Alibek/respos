using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Audit;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Branches.Common;
using Restaurant.Domain.Common;

namespace Restaurant.Application.Features.Branches.UpdateBranchSettings;

public sealed class UpdateBranchSettingsHandler(IApplicationDbContext db, ITenantContext tenant, IAuditLogger audit)
    : IHandler<UpdateBranchSettingsCommand, BranchSettingsDto>
{
    public async Task<Result<BranchSettingsDto>> HandleAsync(UpdateBranchSettingsCommand request, CancellationToken cancellationToken)
    {
        tenant.RequireOrganizationId();
        var settings = await db.BranchSettings.FirstOrDefaultAsync(s => s.BranchId == request.BranchId, cancellationToken);
        if (settings is null)
        {
            return BranchErrors.NotFound;
        }

        var before = BranchSettingsDto.From(settings);
        settings.ServiceChargePercent = request.ServiceChargePercent;
        settings.TaxPercent = request.TaxPercent;
        settings.AllowNegativeStock = request.AllowNegativeStock;
        settings.ReceiptFooter = request.ReceiptFooter;
        var after = BranchSettingsDto.From(settings);

        audit.Log(new AuditEntry("branch_settings.updated", "branch_settings", settings.Id.ToString(), new { before, after })
        {
            BranchId = settings.BranchId,
        });
        await db.SaveChangesAsync(cancellationToken);
        return after;
    }
}

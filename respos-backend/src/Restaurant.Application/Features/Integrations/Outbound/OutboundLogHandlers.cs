using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Extensions;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Common.Models;
using Restaurant.Application.Features.Integrations.Common;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Integrations;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Integrations.Outbound;

/// <summary><c>GET /integrations/outbound-messages?status=&amp;channel=</c> — the organization's queue/log, newest first.</summary>
public sealed record ListOutboundMessagesQuery : PageQuery
{
    public string? Status { get; init; }
    public string? Channel { get; init; }
}

public sealed class ListOutboundMessagesValidator : AbstractValidator<ListOutboundMessagesQuery>
{
    public ListOutboundMessagesValidator()
    {
        RuleFor(x => x.Status).Must(SnakeCaseEnum.IsValidOrEmpty<OutboundStatus>).WithMessage("Unknown status.");
        RuleFor(x => x.Channel).Must(SnakeCaseEnum.IsValidOrEmpty<OutboundChannel>).WithMessage("Unknown channel.");
    }
}

public sealed class ListOutboundMessagesHandler(IApplicationDbContext db, ITenantContext tenant)
    : IHandler<ListOutboundMessagesQuery, PagedResult<OutboundMessageDto>>
{
    public async Task<Result<PagedResult<OutboundMessageDto>>> HandleAsync(ListOutboundMessagesQuery request, CancellationToken cancellationToken)
    {
        var orgId = tenant.RequireOrganizationId();
        var query = db.OutboundMessages.AsNoTracking().Where(m => m.OrganizationId == orgId);
        if (SnakeCaseEnum.TryParse<OutboundStatus>(request.Status, out var status))
        {
            query = query.Where(m => m.Status == status);
        }

        if (SnakeCaseEnum.TryParse<OutboundChannel>(request.Channel, out var channel))
        {
            query = query.Where(m => m.Channel == channel);
        }

        return await query.OrderByDescending(m => m.CreatedAt).ThenByDescending(m => m.Id)
            .Select(m => new OutboundMessageDto(m.Id, m.Channel, m.Kind, m.RecipientMasked, m.Summary, m.Status, m.Attempts,
                m.MaxAttempts, m.NextAttemptAt, m.LastError, m.CreatedAt, m.SentAt, m.BranchId))
            .ToPagedResultAsync(request, cancellationToken);
    }
}

/// <summary>Integration error log. Organization scope: own rows; platform scope: all rows (+ organization name).</summary>
public sealed record ListIntegrationErrorsQuery : PageQuery
{
    public Guid? OrganizationId { get; init; }
    public string? Type { get; init; }

    /// <summary>Set by the controller: true for <c>/platform/integration-errors</c>.</summary>
    public bool PlatformScope { get; init; }
}

public sealed class ListIntegrationErrorsValidator : AbstractValidator<ListIntegrationErrorsQuery>
{
    public ListIntegrationErrorsValidator() =>
        RuleFor(x => x.Type).Must(SnakeCaseEnum.IsValidOrEmpty<IntegrationType>).WithMessage("Unknown integration type.");
}

public sealed class ListIntegrationErrorsHandler(IApplicationDbContext db, ITenantContext tenant)
    : IHandler<ListIntegrationErrorsQuery, PagedResult<IntegrationErrorDto>>
{
    public async Task<Result<PagedResult<IntegrationErrorDto>>> HandleAsync(ListIntegrationErrorsQuery request, CancellationToken cancellationToken)
    {
        IQueryable<IntegrationErrorLog> query = db.IntegrationErrorLogs.AsNoTracking();
        if (request.PlatformScope)
        {
            if (request.OrganizationId is { } filter)
            {
                query = query.Where(e => e.OrganizationId == filter);
            }
        }
        else
        {
            var orgId = tenant.RequireOrganizationId();
            query = query.Where(e => e.OrganizationId == orgId);
        }

        if (SnakeCaseEnum.TryParse<IntegrationType>(request.Type, out var type))
        {
            query = query.Where(e => e.IntegrationType == type);
        }

        var organizations = db.Organizations.IgnoreQueryFilters();
        return await query.OrderByDescending(e => e.CreatedAt).ThenByDescending(e => e.Id)
            .Select(e => new IntegrationErrorDto(
                e.Id, e.OrganizationId,
                request.PlatformScope ? organizations.Where(o => o.Id == e.OrganizationId).Select(o => o.Name).FirstOrDefault() : null,
                e.IntegrationType, e.Channel, e.Operation, e.Message, e.OutboundMessageId, e.CreatedAt))
            .ToPagedResultAsync(request, cancellationToken);
    }
}

using System.Text.Json;
using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Integrations;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Integrations.Common;
using Restaurant.Domain.Entities.Integrations;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Integrations.Outbound;

/// <param name="Recipient">Chat id / phone / e-mail — stored only inside the encrypted payload.</param>
/// <param name="Summary">Short, secret-free description shown in the outbound log.</param>
public sealed record OutboundRequest(
    Guid? OrganizationId,
    Guid? BranchId,
    OutboundChannel Channel,
    string Kind,
    string Recipient,
    string Summary,
    string Body,
    string? Subject = null,
    string? HtmlBody = null,
    string? DedupeKey = null);

/// <summary>Decrypted queue payload.</summary>
public sealed record OutboundPayload(string Recipient, string Body, string? Subject, string? HtmlBody);

/// <summary>Adds <see cref="OutboundMessage"/> rows to the current unit of work (never saves — safe in domain event handlers).</summary>
[ScopedService]
public sealed class OutboundQueue(IApplicationDbContext db, ISecretProtector protector, IClock clock)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public OutboundMessage Enqueue(OutboundRequest request)
    {
        var now = clock.UtcNow;
        var payload = new OutboundPayload(request.Recipient, request.Body, request.Subject, request.HtmlBody);
        var message = new OutboundMessage
        {
            OrganizationId = request.OrganizationId,
            BranchId = request.BranchId,
            Channel = request.Channel,
            Kind = request.Kind,
            RecipientMasked = SecretMask.Recipient(request.Recipient),
            Summary = request.Summary.Length <= 200 ? request.Summary : request.Summary[..200],
            ProtectedPayload = protector.Protect(JsonSerializer.Serialize(payload, Json)),
            DedupeKey = request.DedupeKey,
            CreatedAt = now,
            NextAttemptAt = now,
        };
        db.OutboundMessages.Add(message);
        return message;
    }

    public OutboundPayload? ReadPayload(OutboundMessage message)
    {
        if (string.IsNullOrEmpty(message.ProtectedPayload))
        {
            return null;
        }

        var json = protector.Unprotect(message.ProtectedPayload);
        return json is null ? null : JsonSerializer.Deserialize<OutboundPayload>(json, Json);
    }
}

using Restaurant.Application.Abstractions.Clock;
using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Abstractions.Persistence;
using Restaurant.Application.Common.Handlers;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Saas;

namespace Restaurant.Application.Features.Public.CreateDemoRequest;

/// <summary>Stores a landing-page demo request (anonymous, rate-limited). Honeypot hits are dropped silently.</summary>
public sealed class CreateDemoRequestHandler(IApplicationDbContext db, IRequestInfo requestInfo, IClock clock)
    : IHandler<CreateDemoRequestCommand, Unit>
{
    public async Task<Result<Unit>> HandleAsync(CreateDemoRequestCommand request, CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(request.Website))
        {
            return Unit.Value;
        }

        db.DemoRequests.Add(new DemoRequest
        {
            Name = request.Name.Trim(),
            Phone = request.Phone.Trim(),
            Email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim(),
            RestaurantName = request.RestaurantName.Trim(),
            City = request.City,
            Message = request.Message,
            IpAddress = requestInfo.IpAddress,
            CreatedAt = clock.UtcNow,
        });
        await db.SaveChangesAsync(cancellationToken);
        return Unit.Value;
    }
}

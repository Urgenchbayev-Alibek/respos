using Restaurant.Application.Abstractions.Context;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Features.Users.Common;
using Restaurant.Domain.Common;

namespace Restaurant.Application.Features.Users.GetUser;

public sealed record GetUserQuery(Guid Id);

/// <summary>Users of other organizations are invisible → 404.</summary>
public sealed class GetUserHandler(ITenantContext tenant, UserReadService reader) : IHandler<GetUserQuery, UserDto>
{
    public async Task<Result<UserDto>> HandleAsync(GetUserQuery request, CancellationToken cancellationToken)
    {
        tenant.RequireOrganizationId();
        var user = await reader.GetAsync(request.Id, cancellationToken);
        return user is null ? UserErrors.NotFound : user;
    }
}

using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Identity;
using Restaurant.Domain.Enums;

namespace Restaurant.Application.Features.Organizations.Common;

public sealed record OrganizationDto(
    Guid Id, string Name, string Slug, string Currency, string DefaultLanguage, OrganizationStatus Status, bool IsDemo)
{
    public static OrganizationDto From(Organization o) =>
        new(o.Id, o.Name, o.Slug, o.Currency, o.DefaultLanguage, o.Status, o.IsDemo);
}

public static class OrganizationErrors
{
    public static readonly Error NotFound = Error.NotFound("organization.not_found", "Organization not found.");
}

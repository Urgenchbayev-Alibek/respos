namespace Restaurant.Application.Features.Organizations.UpdateOrganization;

public sealed record UpdateOrganizationCommand(string Name, string Currency, string DefaultLanguage);

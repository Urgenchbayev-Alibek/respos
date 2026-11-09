namespace Restaurant.Application.Common.Options;

/// <summary>Frontend URLs (section "Frontend"), used to build links in e-mails / invitations.</summary>
public sealed class FrontendOptions
{
    public const string SectionName = "Frontend";

    public string AppUrl { get; set; } = "http://localhost:5173";
}

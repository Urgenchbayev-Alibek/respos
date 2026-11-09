using System.Net;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Configuration;
using Restaurant.Api.Extensions;
using Restaurant.Api.Hubs;
using Restaurant.IntegrationTests.Infrastructure;
using Serilog.Events;
using Serilog.Parsing;

namespace Restaurant.IntegrationTests.Hardening;

[Collection(ApiCollection.Name)]
public sealed class SecurityHeadersTests(ApiFactory factory) : ApiTestBase(factory)
{
    [Theory]
    [InlineData("/health/live", HttpStatusCode.OK)]
    [InlineData("/api/v1/notifications", HttpStatusCode.Unauthorized)]
    public async Task Responses_carry_security_headers(string path, HttpStatusCode expected)
    {
        var response = await CreateClient().GetAsync(path);

        response.StatusCode.Should().Be(expected);
        response.Headers.GetValues("X-Content-Type-Options").Should().ContainSingle().Which.Should().Be("nosniff");
        response.Headers.GetValues("Referrer-Policy").Should().ContainSingle().Which.Should().Be("no-referrer");
        response.Headers.GetValues("X-Frame-Options").Should().ContainSingle().Which.Should().Be("DENY");
    }
}

public sealed class StartupConfigurationValidatorTests
{
    private static IConfiguration Config(string? connection, string? key) => new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:DefaultConnection"] = connection,
            ["Jwt:SigningKey"] = key,
        })
        .Build();

    [Fact]
    public void Valid_configuration_passes() =>
        StartupConfigurationValidator.GetErrors(Config("Host=db", new string('k', 32))).Should().BeEmpty();

    [Theory]
    [InlineData(null, "short-key", 2)]
    [InlineData("", null, 2)]
    [InlineData("Host=db", "31-bytes-key-xxxxxxxxxxxxxxxxxx", 1)]
    [InlineData(null, "a-valid-signing-key-of-at-least-32-bytes", 1)]
    public void Missing_or_weak_values_are_reported(string? connection, string? key, int expectedErrors)
    {
        var config = Config(connection, key);

        StartupConfigurationValidator.GetErrors(config).Should().HaveCount(expectedErrors);
        var act = () => config.ValidateRequiredConfiguration();
        act.Should().Throw<InvalidOperationException>().WithMessage("Invalid configuration*");
    }
}

public sealed class HubErrorLoggingTests
{
    private const string Dispatcher = "Microsoft.AspNetCore.SignalR.Internal.DefaultHubDispatcher";

    private static LogEvent Event(Exception exception, string source) => new(
        DateTimeOffset.UtcNow, LogEventLevel.Error, exception, new MessageTemplate("x", []),
        [new LogEventProperty("SourceContext", new ScalarValue(source))]);

    [Fact]
    public void Dispatcher_error_for_hub_exception_is_dropped() =>
        HubErrorLoggingFilter.IsExpectedHubError(Event(new HubException("tenant.branch_forbidden"), Dispatcher)).Should().BeTrue();

    [Fact]
    public void Unexpected_hub_errors_are_kept()
    {
        HubErrorLoggingFilter.IsExpectedHubError(Event(new InvalidOperationException("boom"), Dispatcher)).Should().BeFalse();
        HubErrorLoggingFilter.IsExpectedHubError(Event(new HubException("x"), "Restaurant.Api.Other")).Should().BeFalse();
    }
}

using System.Net;
using Microsoft.AspNetCore.Http;
using Restaurant.Api.Controllers;
using Restaurant.Api.Extensions;

namespace Restaurant.IntegrationTests.Auth;

/// <summary>
/// `POST /auth/refresh` is rate limited per session (refresh cookie), not per IP: restaurant devices share one
/// NAT address and reload together after a power cut — a per-IP window logged most of them out (found by the UI smoke).
/// </summary>
public sealed class RefreshRateLimitPartitionTests
{
    private static HttpContext Request(string ip, string? refreshToken)
    {
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = IPAddress.Parse(ip);
        if (refreshToken is not null)
        {
            context.Request.Headers.Cookie = $"{AuthController.RefreshCookieName}={refreshToken}";
        }

        return context;
    }

    [Fact]
    public void Devices_behind_one_ip_get_separate_partitions()
    {
        var tablet = RateLimitingExtensions.RefreshPartitionKey(Request("10.0.0.1", "token-a"));
        var kds = RateLimitingExtensions.RefreshPartitionKey(Request("10.0.0.1", "token-b"));

        tablet.Should().NotBe(kds);
        tablet.Should().StartWith("rt:").And.NotContain("token-a");
        RateLimitingExtensions.RefreshPartitionKey(Request("10.0.0.2", "token-a")).Should().Be(tablet);
    }

    [Fact]
    public void Requests_without_a_cookie_fall_back_to_the_ip()
    {
        RateLimitingExtensions.RefreshPartitionKey(Request("10.0.0.1", null)).Should().Be("ip:10.0.0.1");
    }
}

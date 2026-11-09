using System.Net;
using Microsoft.AspNetCore.HttpOverrides;
using Restaurant.Api.Middleware;
using IPNetwork = Microsoft.AspNetCore.HttpOverrides.IPNetwork;

namespace Restaurant.Api.Extensions;

/// <summary>
/// Reverse-proxy aware HTTP settings (section <c>Http</c>):
/// <list type="bullet">
/// <item><c>Http:KnownProxies</c> / <c>Http:KnownNetworks</c> (IPs / CIDRs, array or comma list) — proxies whose
/// X-Forwarded-For/Proto are trusted. When BOTH are empty the defaults (loopback only) are cleared and any sender is
/// trusted: fine on PaaS where the app is reachable only through the platform proxy (dynamic proxy IPs); with
/// ForwardLimit=1 only the entry appended by the nearest proxy is used. Configure them when the app is directly reachable.</item>
/// <item><c>Http:UseHttpsRedirection</c> (default false) — HSTS + HTTPS redirect outside Development. Off by default
/// because TLS usually terminates at the proxy/PaaS edge, which already redirects and sets HSTS.</item>
/// </list>
/// </summary>
public static class HttpPipelineExtensions
{
    public static IServiceCollection AddApiForwardedHeaders(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<ForwardedHeadersOptions>(options =>
        {
            options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
            options.ForwardLimit = 1;
            var proxies = ReadList(configuration, "Http:KnownProxies");
            var networks = ReadList(configuration, "Http:KnownNetworks");
            options.KnownProxies.Clear();
            options.KnownNetworks.Clear();
            foreach (var proxy in proxies)
            {
                options.KnownProxies.Add(IPAddress.Parse(proxy));
            }

            foreach (var network in networks)
            {
                var parts = network.Split('/', 2);
                options.KnownNetworks.Add(new IPNetwork(IPAddress.Parse(parts[0]), parts.Length == 2 ? int.Parse(parts[1]) : 32));
            }
        });
        return services;
    }

    /// <summary>Forwarded headers, optional HSTS/HTTPS redirect and security headers — call first in the pipeline.</summary>
    public static WebApplication UseApiHttpHardening(this WebApplication app)
    {
        app.UseForwardedHeaders();
        if (!app.Environment.IsDevelopment() && app.Configuration.GetValue<bool>("Http:UseHttpsRedirection"))
        {
            app.UseHsts();
            app.UseHttpsRedirection();
        }

        app.UseMiddleware<SecurityHeadersMiddleware>();
        return app;
    }

    private static string[] ReadList(IConfiguration configuration, string key)
    {
        var section = configuration.GetSection(key);
        return section.Get<string[]>()
            ?? (section.Value ?? string.Empty).Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    }
}

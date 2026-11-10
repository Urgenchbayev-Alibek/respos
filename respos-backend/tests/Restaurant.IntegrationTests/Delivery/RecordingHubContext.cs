using System.Collections.Concurrent;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Restaurant.Api.Hubs;
using Restaurant.IntegrationTests.Infrastructure;

namespace Restaurant.IntegrationTests.Delivery;

public sealed record RecordedMessage(string Target, string Method, object?[] Args);

/// <summary>
/// Test double for <see cref="IHubContext{THub}"/> that records what the realtime flusher sends after commit
/// (nothing reaches real connections). Use <see cref="CreateFactory"/> for a host that sends through it.
/// </summary>
public sealed class RecordingHubContext : IHubContext<RestaurantHub>, IGroupManager
{
    private readonly ConcurrentQueue<RecordedMessage> _messages = new();

    public RecordingHubContext() => Clients = new RecordingClients(_messages);

    public IReadOnlyList<RecordedMessage> Messages => _messages.ToArray();

    public IHubClients Clients { get; }

    public IGroupManager Groups => this;

    public static WebApplicationFactory<Program> CreateFactory(ApiFactory factory, RecordingHubContext recorder) =>
        factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            services.AddSingleton<IHubContext<RestaurantHub>>(recorder)));

    public Task AddToGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default) => Task.CompletedTask;

    public Task RemoveFromGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default) => Task.CompletedTask;

    private sealed class RecordingClients(ConcurrentQueue<RecordedMessage> messages) : IHubClients
    {
        public IClientProxy All => Proxy("all");

        public IClientProxy AllExcept(IReadOnlyList<string> excludedConnectionIds) => Proxy("all");

        public IClientProxy Client(string connectionId) => Proxy($"connection:{connectionId}");

        public IClientProxy Clients(IReadOnlyList<string> connectionIds) => Proxy("connections");

        public IClientProxy Group(string groupName) => Proxy(groupName);

        public IClientProxy GroupExcept(string groupName, IReadOnlyList<string> excludedConnectionIds) => Proxy(groupName);

        public IClientProxy Groups(IReadOnlyList<string> groupNames) => Proxy(string.Join(',', groupNames));

        public IClientProxy User(string userId) => Proxy($"user:{userId}");

        public IClientProxy Users(IReadOnlyList<string> userIds) => Proxy("users");

        private RecordingProxy Proxy(string target) => new(target, messages);
    }

    private sealed class RecordingProxy(string target, ConcurrentQueue<RecordedMessage> messages) : IClientProxy
    {
        public Task SendCoreAsync(string method, object?[] args, CancellationToken cancellationToken = default)
        {
            messages.Enqueue(new RecordedMessage(target, method, args));
            return Task.CompletedTask;
        }
    }
}

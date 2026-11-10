using System.Net;
using System.Text;
using Microsoft.Extensions.Caching.Memory;
using Restaurant.Application.Abstractions.Integrations;
using Restaurant.Infrastructure.Integrations;
using Restaurant.Infrastructure.Integrations.Sms;
using Restaurant.Infrastructure.Integrations.Telegram;

namespace Restaurant.IntegrationTests.Integrations;

/// <summary>Provider adapters against a fake HttpMessageHandler (no network).</summary>
public sealed class ProviderClientTests
{
    private const string Token = "123456789:AAFakeTokenForTests_abcdefghijWXYZ";

    private readonly List<TimeSpan> _delays = [];

    private IntegrationRetry Retry() => new(new IntegrationsOptions(), (delay, _) =>
    {
        _delays.Add(delay);
        return Task.CompletedTask;
    });

    private static HttpClient Http(FakeHandler handler, string baseUrl) => new(handler) { BaseAddress = new Uri(baseUrl) };

    [Fact]
    public async Task Telegram_success_posts_to_send_message()
    {
        var handler = new FakeHandler(_ => FakeHandler.Json(HttpStatusCode.OK, """{"ok":true,"result":{}}"""));
        var client = new TelegramBotClient(Http(handler, "https://api.telegram.org/"), Retry());

        var result = await client.SendMessageAsync(Token, "-100123", "hello", default);

        result.Succeeded.Should().BeTrue();
        handler.Requests.Should().ContainSingle();
        handler.Requests[0].Uri.Should().Be($"https://api.telegram.org/bot{Token}/sendMessage");
        handler.Requests[0].Body.Should().Contain("\"chat_id\":\"-100123\"").And.Contain("hello");
    }

    [Fact]
    public async Task Telegram_429_is_retried_after_retry_after()
    {
        var calls = 0;
        var handler = new FakeHandler(_ => ++calls == 1
            ? FakeHandler.Json(HttpStatusCode.TooManyRequests, """{"ok":false,"error_code":429,"description":"Too Many Requests: retry after 2","parameters":{"retry_after":2}}""")
            : FakeHandler.Json(HttpStatusCode.OK, """{"ok":true}"""));
        var client = new TelegramBotClient(Http(handler, "https://api.telegram.org/"), Retry());

        var result = await client.SendMessageAsync(Token, "1", "x", default);

        result.Succeeded.Should().BeTrue();
        calls.Should().Be(2);
        _delays.Should().Equal(TimeSpan.FromSeconds(2));
    }

    [Fact]
    public async Task Telegram_long_retry_after_is_left_to_the_queue()
    {
        var handler = new FakeHandler(_ => FakeHandler.Json(HttpStatusCode.TooManyRequests,
            """{"ok":false,"description":"Too Many Requests","parameters":{"retry_after":120}}"""));
        var result = await new TelegramBotClient(Http(handler, "https://api.telegram.org/"), Retry()).SendMessageAsync(Token, "1", "x", default);

        result.Succeeded.Should().BeFalse();
        result.Retryable.Should().BeTrue();
        result.RetryAfter.Should().Be(TimeSpan.FromSeconds(120));
        handler.Requests.Should().ContainSingle();
    }

    [Fact]
    public async Task Telegram_unauthorized_is_not_retried_and_error_has_no_token()
    {
        var handler = new FakeHandler(_ => FakeHandler.Json(HttpStatusCode.Unauthorized, """{"ok":false,"error_code":401,"description":"Unauthorized"}"""));
        var result = await new TelegramBotClient(Http(handler, "https://api.telegram.org/"), Retry()).SendMessageAsync(Token, "1", "x", default);

        result.Succeeded.Should().BeFalse();
        result.Retryable.Should().BeFalse();
        result.Error.Should().Contain("401").And.Contain("Unauthorized").And.NotContain(Token);
        handler.Requests.Should().ContainSingle();
    }

    [Fact]
    public async Task Telegram_network_errors_are_retried_and_scrubbed()
    {
        var handler = new FakeHandler(_ => throw new HttpRequestException($"Connection refused (api.telegram.org/bot{Token})"));
        var result = await new TelegramBotClient(Http(handler, "https://api.telegram.org/"), Retry()).SendMessageAsync(Token, "1", "x", default);

        result.Succeeded.Should().BeFalse();
        result.Retryable.Should().BeTrue();
        result.Error.Should().NotContain(Token);
        handler.Requests.Should().HaveCount(3, "3 in-request attempts by default");
        _delays.Should().Equal(TimeSpan.FromMilliseconds(500), TimeSpan.FromMilliseconds(1000));
    }

    [Fact]
    public async Task Telegram_rejects_malformed_tokens_without_a_request()
    {
        var handler = new FakeHandler(_ => FakeHandler.Json(HttpStatusCode.OK, "{}"));
        var result = await new TelegramBotClient(Http(handler, "https://api.telegram.org/"), Retry()).SendMessageAsync("../evil", "1", "x", default);
        result.Succeeded.Should().BeFalse();
        handler.Requests.Should().BeEmpty();
    }

    [Fact]
    public async Task Eskiz_logs_in_once_then_sends_with_bearer_token()
    {
        var handler = new FakeHandler(req => req.RequestUri!.AbsolutePath switch
        {
            "/api/auth/login" => FakeHandler.Json(HttpStatusCode.OK, """{"message":"token_generated","data":{"token":"eskiz-jwt"}}"""),
            "/api/message/sms/send" => FakeHandler.Json(HttpStatusCode.OK, """{"id":"1","status":"waiting"}"""),
            _ => FakeHandler.Json(HttpStatusCode.NotFound, "{}"),
        });
        var client = new EskizSmsClient(Http(handler, "https://notify.eskiz.uz/"), Retry(), new MemoryCache(new MemoryCacheOptions()));
        var credentials = new EskizCredentials("owner@mail.uz", "eskiz-password", "4546");

        (await client.SendAsync(credentials, "+998901234567", "Бронь подтверждена", default)).Succeeded.Should().BeTrue();
        (await client.SendAsync(credentials, "+998901234567", "Ещё одно", default)).Succeeded.Should().BeTrue();

        handler.Requests.Count(r => r.Uri.EndsWith("/api/auth/login")).Should().Be(1, "token is cached");
        var send = handler.Requests.First(r => r.Uri.EndsWith("/sms/send"));
        send.Authorization.Should().Be("Bearer eskiz-jwt");
        send.Body.Should().Contain("mobile_phone=998901234567").And.Contain("from=4546");
    }

    [Fact]
    public async Task Eskiz_expired_token_triggers_one_relogin()
    {
        var logins = 0;
        var sends = 0;
        var handler = new FakeHandler(req => req.RequestUri!.AbsolutePath.EndsWith("/login")
            ? FakeHandler.Json(HttpStatusCode.OK, "{\"data\":{\"token\":\"t" + ++logins + "\"}}")
            : ++sends == 1 ? FakeHandler.Json(HttpStatusCode.Unauthorized, """{"message":"Expired"}""") : FakeHandler.Json(HttpStatusCode.OK, "{}"));
        var client = new EskizSmsClient(Http(handler, "https://notify.eskiz.uz/"), Retry(), new MemoryCache(new MemoryCacheOptions()));

        var result = await client.SendAsync(new EskizCredentials("e@mail.uz", "p", "4546"), "+998901234567", "x", default);

        result.Succeeded.Should().BeTrue();
        logins.Should().Be(2);
        handler.Requests.Last().Authorization.Should().Be("Bearer t2");
    }

    [Fact]
    public async Task Eskiz_bad_credentials_fail_without_retry_or_password_in_error()
    {
        var handler = new FakeHandler(_ => FakeHandler.Json(HttpStatusCode.Unauthorized, """{"message":"Invalid credentials"}"""));
        var client = new EskizSmsClient(Http(handler, "https://notify.eskiz.uz/"), Retry(), new MemoryCache(new MemoryCacheOptions()));

        var result = await client.SendAsync(new EskizCredentials("e@mail.uz", "TopSecret99", "4546"), "+998901234567", "x", default);

        result.Succeeded.Should().BeFalse();
        result.Error.Should().Contain("authentication").And.NotContain("TopSecret99");
        handler.Requests.Should().ContainSingle();
    }
}

internal sealed class FakeHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
{
    public sealed record Captured(string Uri, string Body, string? Authorization);

    public List<Captured> Requests { get; } = [];

    public static HttpResponseMessage Json(HttpStatusCode status, string json) =>
        new(status) { Content = new StringContent(json, Encoding.UTF8, "application/json") };

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var body = request.Content is null ? string.Empty : await request.Content.ReadAsStringAsync(cancellationToken);
        Requests.Add(new Captured(request.RequestUri!.ToString(), body, request.Headers.Authorization?.ToString()));
        return respond(request);
    }
}

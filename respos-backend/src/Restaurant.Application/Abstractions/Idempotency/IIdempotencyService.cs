namespace Restaurant.Application.Abstractions.Idempotency;

public enum IdempotencyState
{
    /// <summary>Key reserved for this request; execute and then call CompleteAsync / AbandonAsync.</summary>
    Started,

    /// <summary>A completed response exists for the same key + user + request → replay it.</summary>
    Replay,

    /// <summary>Same key was used with a different request body → 422.</summary>
    Mismatch,

    /// <summary>Another request with the same key is still running → 409.</summary>
    InProgress,
}

public sealed record IdempotencyBeginResult(IdempotencyState State, Guid RecordId, int? ResponseStatus, string? ResponseBody);

/// <summary>Backs the <c>[RequireIdempotencyKey]</c> filter (records kept 24h, unique Key + UserId).</summary>
public interface IIdempotencyService
{
    Task<IdempotencyBeginResult> BeginAsync(string key, Guid userId, string requestHash, CancellationToken cancellationToken = default);

    Task CompleteAsync(Guid recordId, int responseStatus, string? responseBody, CancellationToken cancellationToken = default);

    Task AbandonAsync(Guid recordId, CancellationToken cancellationToken = default);
}

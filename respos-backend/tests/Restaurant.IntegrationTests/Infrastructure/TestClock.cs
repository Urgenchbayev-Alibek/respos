using Restaurant.Application.Abstractions.Clock;

namespace Restaurant.IntegrationTests.Infrastructure;

/// <summary>
/// System time plus a test-controlled offset (replaces <see cref="IClock"/> in <see cref="ApiFactory"/>).
/// The api collection runs sequentially; tests that <see cref="Advance"/> must <see cref="Reset"/> in a finally.
/// </summary>
public sealed class TestClock : IClock
{
    private long _offsetTicks;

    public DateTime UtcNow => DateTime.UtcNow.AddTicks(Interlocked.Read(ref _offsetTicks));

    public void Advance(TimeSpan by) => Interlocked.Add(ref _offsetTicks, by.Ticks);

    public void Reset() => Interlocked.Exchange(ref _offsetTicks, 0);
}

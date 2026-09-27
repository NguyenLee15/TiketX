namespace TickeX.Infrastructure.Payments;

public sealed class PayOSResilienceGate
{
    private readonly object _sync = new();
    private int _consecutiveFailures;
    private DateTime _openUntilUtc;

    public bool TryEnter()
    {
        lock (_sync)
        {
            return DateTime.UtcNow >= _openUntilUtc;
        }
    }

    public void RecordSuccess()
    {
        lock (_sync)
        {
            _consecutiveFailures = 0;
            _openUntilUtc = DateTime.MinValue;
        }
    }

    public void RecordFailure()
    {
        lock (_sync)
        {
            _consecutiveFailures++;
            if (_consecutiveFailures >= 5)
                _openUntilUtc = DateTime.UtcNow.AddSeconds(30);
        }
    }
}

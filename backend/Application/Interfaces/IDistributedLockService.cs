namespace TickeX.Application.Interfaces;

public interface IDistributedLockService
{
    Task<IDistributedLockLease?> AcquireLockAsync(string lockKey, TimeSpan expiration, CancellationToken cancellationToken);
}

public interface IDistributedLockLease : IAsyncDisposable
{
    bool IsValid { get; }
}

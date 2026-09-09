namespace TickeX.Application.Interfaces;

public interface IDistributedLockService
{
    Task<bool> AcquireLockAsync(string lockKey, TimeSpan expiration, CancellationToken cancellationToken);
    Task ReleaseLockAsync(string lockKey);
}

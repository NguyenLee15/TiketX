using StackExchange.Redis;
using TickeX.Application.Interfaces;

namespace TickeX.Infrastructure.Services;

public sealed class RedisDistributedLockService : IDistributedLockService
{
    private const string RenewScript = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('pexpire', KEYS[1], ARGV[2]) else return 0 end";
    private const string ReleaseScript = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";
    private readonly IConnectionMultiplexer _redis;

    public RedisDistributedLockService(IConnectionMultiplexer redis) => _redis = redis;

    public async Task<IDistributedLockLease?> AcquireLockAsync(string lockKey, TimeSpan expiration, CancellationToken cancellationToken)
    {
        if (!_redis.IsConnected || expiration <= TimeSpan.Zero) return null;
        cancellationToken.ThrowIfCancellationRequested();
        var token = Guid.NewGuid().ToString("N");
        try
        {
            var database = _redis.GetDatabase();
            if (!await database.StringSetAsync(lockKey, token, expiration, When.NotExists).ConfigureAwait(false)) return null;
            return new RedisLockLease(database, lockKey, token, expiration);
        }
        catch (RedisException)
        {
            return null;
        }
    }

    private sealed class RedisLockLease : IDistributedLockLease
    {
        private readonly IDatabase _database;
        private readonly RedisKey _key;
        private readonly RedisValue _token;
        private readonly TimeSpan _leaseDuration;
        private readonly CancellationTokenSource _stop = new();
        private readonly Task _renewal;
        private int _valid = 1;
        private int _disposed;

        public RedisLockLease(IDatabase database, RedisKey key, RedisValue token, TimeSpan leaseDuration)
        {
            _database = database;
            _key = key;
            _token = token;
            _leaseDuration = leaseDuration;
            _renewal = RenewUntilStoppedAsync();
        }

        public bool IsValid => Volatile.Read(ref _valid) == 1;

        private async Task RenewUntilStoppedAsync()
        {
            var interval = TimeSpan.FromTicks(Math.Max(TimeSpan.FromMilliseconds(100).Ticks, _leaseDuration.Ticks / 3));
            try
            {
                while (true)
                {
                    await Task.Delay(interval, _stop.Token).ConfigureAwait(false);
                    var renewed = await _database.ScriptEvaluateAsync(
                        RenewScript,
                        new[] { _key },
                        new RedisValue[] { _token, (long)_leaseDuration.TotalMilliseconds }).ConfigureAwait(false);
                    if ((long)renewed != 1)
                    {
                        Interlocked.Exchange(ref _valid, 0);
                        return;
                    }
                }
            }
            catch (OperationCanceledException) when (_stop.IsCancellationRequested) { }
            catch (Exception ex) when (ex is RedisException or ObjectDisposedException)
            {
                Interlocked.Exchange(ref _valid, 0);
            }
        }

        public async ValueTask DisposeAsync()
        {
            if (Interlocked.Exchange(ref _disposed, 1) != 0) return;
            await _stop.CancelAsync().ConfigureAwait(false);
            await _renewal.ConfigureAwait(false);
            if (!IsValid) { _stop.Dispose(); return; }
            try
            {
                await _database.ScriptEvaluateAsync(ReleaseScript, new[] { _key }, new[] { _token }).ConfigureAwait(false);
            }
            catch (RedisException)
            {
                // The lease expires automatically; never release without checking its owner token.
            }
            finally { _stop.Dispose(); }
        }
    }
}

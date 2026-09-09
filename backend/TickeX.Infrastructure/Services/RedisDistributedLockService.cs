using StackExchange.Redis;
using TickeX.Application.Interfaces;

namespace TickeX.Infrastructure.Services;

public class RedisDistributedLockService : IDistributedLockService
{
    private readonly IConnectionMultiplexer _redis;
    private readonly System.Collections.Concurrent.ConcurrentDictionary<string, string> _ownedTokens = new();

    public RedisDistributedLockService(IConnectionMultiplexer redis)
    {
        _redis = redis;
    }

    public async Task<bool> AcquireLockAsync(string lockKey, TimeSpan expiration, CancellationToken cancellationToken)
    {
        if (!_redis.IsConnected) return false;
        try
        {
            var token = Guid.NewGuid().ToString("N");
            var acquired = await _redis.GetDatabase().StringSetAsync(lockKey, token, expiration, When.NotExists);
            if (acquired) _ownedTokens[lockKey] = token;
            return acquired;
        }
        catch { return false; }
    }

    public async Task ReleaseLockAsync(string lockKey)
    {
        if (!_ownedTokens.TryRemove(lockKey, out var token) || !_redis.IsConnected) return;
        const string compareAndDelete = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";
        try
        {
            await _redis.GetDatabase().ScriptEvaluateAsync(
                compareAndDelete,
                new RedisKey[] { lockKey },
                new RedisValue[] { token });
        }
        catch
        {
            // The lease has a TTL. Never delete a lock when ownership cannot be verified.
        }
    }
}

using StackExchange.Redis;
using TickeX.Application.Interfaces;

namespace TickeX.Infrastructure.Services;

public sealed class RedisIdempotencyStore(IConnectionMultiplexer redis) : IIdempotencyStore
{
    private const string ClaimScript = "local existing=redis.call('get',KEYS[1]); if existing then return {0,existing,''} end; redis.call('set',KEYS[1],ARGV[1], 'PX',ARGV[2]); return {1,'',ARGV[3]}";
    private const string CompleteScript = "local current=redis.call('get',KEYS[1]); if current and string.sub(current,1,string.len(ARGV[1])) == ARGV[1] then redis.call('set',KEYS[1],ARGV[2], 'PX',ARGV[3]); return 1 else return 0 end";
    private const string ReleaseScript = "local current=redis.call('get',KEYS[1]); if current and string.sub(current,1,string.len(ARGV[1])) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end";

    public async Task<IdempotencyClaim> TryClaimAsync(string key, string processingRecord, TimeSpan ttl, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (!redis.IsConnected) throw new RedisConnectionException(ConnectionFailureType.UnableToConnect, "Redis is disconnected");
        var token = Guid.NewGuid().ToString("N");
        var processing = $"{token}\n{processingRecord}";
        var result = (RedisResult[]?)await redis.GetDatabase().ScriptEvaluateAsync(
            ClaimScript, new RedisKey[] { key }, new RedisValue[] { processing, (long)ttl.TotalMilliseconds, token }).ConfigureAwait(false);
        if (result is null || result.Length != 3) throw new RedisException("Invalid Redis idempotency claim response.");
        var acquired = (long)result[0] == 1;
        var existing = acquired ? null : (string?)result[1];
        return new IdempotencyClaim(acquired, existing, token);
    }

    public async Task CompleteAsync(string key, string ownerToken, string completedRecord, TimeSpan ttl, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (!redis.IsConnected) throw new RedisConnectionException(ConnectionFailureType.UnableToConnect, "Redis is disconnected");
        await redis.GetDatabase().ScriptEvaluateAsync(CompleteScript, new RedisKey[] { key }, new RedisValue[] { ownerToken, $"{ownerToken}\n{completedRecord}", (long)ttl.TotalMilliseconds }).ConfigureAwait(false);
    }

    public async Task ReleaseAsync(string key, string ownerToken, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (!redis.IsConnected) return;
        await redis.GetDatabase().ScriptEvaluateAsync(ReleaseScript, new RedisKey[] { key }, new RedisValue[] { ownerToken }).ConfigureAwait(false);
    }
}

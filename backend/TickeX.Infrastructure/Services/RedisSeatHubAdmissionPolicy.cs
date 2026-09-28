using StackExchange.Redis;
using TickeX.Application.Interfaces;

namespace TickeX.Infrastructure.Services;

public sealed class RedisSeatHubAdmissionPolicy(IConnectionMultiplexer redis) : ISeatHubAdmissionPolicy
{
    private const int JoinLimitPerMinute = 30;
    private const int MaximumGroupsPerConnection = 3;
    private static readonly TimeSpan StateTtl = TimeSpan.FromMinutes(10);

    private const string TryJoinScript = """
        local rateKey = KEYS[1]
        local groupsKey = KEYS[2]
        local eventId = ARGV[1]
        local limit = tonumber(ARGV[2])
        local ttlSeconds = tonumber(ARGV[3])

        if redis.call('SISMEMBER', groupsKey, eventId) == 1 then
            return 1
        end

        local count = tonumber(redis.call('GET', rateKey) or '0')
        if count >= limit then
            return 0
        end

        local groupsCount = tonumber(redis.call('SCARD', groupsKey) or '0')
        if groupsCount >= tonumber(ARGV[4]) then
            return 0
        end

        redis.call('INCR', rateKey)
        redis.call('EXPIRE', rateKey, 60)
        redis.call('SADD', groupsKey, eventId)
        redis.call('EXPIRE', groupsKey, ttlSeconds)
        return 1
        """;

    public async Task<bool> TryJoinAsync(string connectionId, string? clientIp, Guid eventId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(connectionId) || eventId == Guid.Empty || !redis.IsConnected)
            return false;

        var normalizedIp = string.IsNullOrWhiteSpace(clientIp) ? "unknown" : clientIp.Trim();
        var minute = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 60;
        var database = redis.GetDatabase();
        var result = await database.ScriptEvaluateAsync(
            TryJoinScript,
            new RedisKey[]
            {
                $"tickex:seat-hub:joins:{normalizedIp}:{minute}",
                GroupKey(connectionId)
            },
            new RedisValue[]
            {
                eventId.ToString("N"),
                JoinLimitPerMinute,
                (long)StateTtl.TotalSeconds,
                MaximumGroupsPerConnection
            }).WaitAsync(cancellationToken).ConfigureAwait(false);

        return (long)result == 1;
    }

    public async Task ReleaseAsync(string connectionId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(connectionId) || !redis.IsConnected)
            return;

        await redis.GetDatabase().KeyDeleteAsync(GroupKey(connectionId)).WaitAsync(cancellationToken).ConfigureAwait(false);
    }

    private static RedisKey GroupKey(string connectionId) => $"tickex:seat-hub:groups:{connectionId}";
}

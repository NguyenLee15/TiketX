using StackExchange.Redis;
using TickeX.Application.Interfaces;
using TickeX.Infrastructure.Services;

namespace TickeX.UnitTests.Customer;

public sealed class RedisUserSecurityStateCacheTests
{
    [Fact]
    public async Task IndependentRedisClientReadsAndUpdatesSecurityState()
    {
        var connection = Environment.GetEnvironmentVariable("REDIS_TEST_CONNECTION");
        if (string.IsNullOrWhiteSpace(connection)) return;

        using var redis = await ConnectionMultiplexer.ConnectAsync(connection);
        var cache = new RedisUserSecurityStateCache(redis);
        var userId = Guid.NewGuid();
        var key = $"tickex:security-state:{userId:N}";

        await cache.SetAsync(userId, new UserSecurityState("stamp-a", false), CancellationToken.None);
        (await cache.GetAsync(userId, CancellationToken.None))
            .Should().BeEquivalentTo(new UserSecurityState("stamp-a", false));

        await cache.SetAsync(userId, new UserSecurityState("stamp-b", true), CancellationToken.None);
        (await cache.GetAsync(userId, CancellationToken.None))
            .Should().BeEquivalentTo(new UserSecurityState("stamp-b", true));

        await redis.GetDatabase().KeyDeleteAsync(key);
    }
}

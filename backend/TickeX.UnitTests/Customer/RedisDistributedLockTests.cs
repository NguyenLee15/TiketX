using FluentAssertions;
using Moq;
using StackExchange.Redis;
using TickeX.Application.Interfaces;
using TickeX.Infrastructure.Services;
using Xunit;

namespace TickeX.UnitTests.Customer;

public sealed class RedisDistributedLockTests
{
    private static string? RedisTestConnection => Environment.GetEnvironmentVariable("REDIS_TEST_CONNECTION");

    [Fact]
    public async Task Acquire_WhenRedisIsDisconnected_FailsClosed()
    {
        var redis = new Mock<IConnectionMultiplexer>();
        redis.SetupGet(x => x.IsConnected).Returns(false);
        var service = new RedisDistributedLockService(redis.Object);

        var acquired = await service.AcquireLockAsync("financial-operation", TimeSpan.FromSeconds(5), CancellationToken.None);

        acquired.Should().BeNull();
    }

    [Fact]
    public async Task LeaseLost_WhenOldOwnerDisposes_DoesNotDeleteReplacementOwner()
    {
        if (string.IsNullOrWhiteSpace(RedisTestConnection)) return;
        using var redis = await ConnectionMultiplexer.ConnectAsync(RedisTestConnection);
        var key = $"lock-test:{Guid.NewGuid():N}";
        var database = redis.GetDatabase();
        var service = new RedisDistributedLockService(redis);
        var oldLease = await service.AcquireLockAsync(key, TimeSpan.FromSeconds(3), CancellationToken.None);
        oldLease.Should().NotBeNull();
        var replacementToken = Guid.NewGuid().ToString("N");
        await database.StringSetAsync(key, replacementToken, TimeSpan.FromSeconds(3));

        await oldLease!.DisposeAsync();

        (await database.StringGetAsync(key)).ToString().Should().Be(replacementToken);
        await database.KeyDeleteAsync(key);
    }

    [Fact]
    public async Task LeaseLost_WhenRedisOwnerChanges_IsMarkedInvalidByRenewal()
    {
        if (string.IsNullOrWhiteSpace(RedisTestConnection)) return;
        using var redis = await ConnectionMultiplexer.ConnectAsync(RedisTestConnection);
        var key = $"lock-test:{Guid.NewGuid():N}";
        var database = redis.GetDatabase();
        var service = new RedisDistributedLockService(redis);
        var lease = await service.AcquireLockAsync(key, TimeSpan.FromSeconds(2), CancellationToken.None);
        lease.Should().NotBeNull();
        await database.StringSetAsync(key, Guid.NewGuid().ToString("N"), TimeSpan.FromSeconds(2));

        await Task.Delay(350);

        lease!.IsValid.Should().BeFalse();
        await lease.DisposeAsync();
        await database.KeyDeleteAsync(key);
    }
}

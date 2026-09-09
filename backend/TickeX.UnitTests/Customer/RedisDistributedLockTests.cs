using FluentAssertions;
using Moq;
using StackExchange.Redis;
using TickeX.Infrastructure.Services;
using Xunit;

namespace TickeX.UnitTests.Customer;

public sealed class RedisDistributedLockTests
{
    [Fact]
    public async Task Acquire_WhenRedisIsDisconnected_FailsClosed()
    {
        var redis = new Mock<IConnectionMultiplexer>();
        redis.SetupGet(x => x.IsConnected).Returns(false);
        var service = new RedisDistributedLockService(redis.Object);

        var acquired = await service.AcquireLockAsync("financial-operation", TimeSpan.FromSeconds(5), CancellationToken.None);

        acquired.Should().BeFalse();
    }
}

using FluentAssertions;
using Moq;
using StackExchange.Redis;
using TickeX.Infrastructure.Services;
using Xunit;

namespace TickeX.UnitTests.Customer;

public sealed class RedisSeatHubAdmissionPolicyTests
{
    [Fact]
    public async Task LeaveGroupRemovesEventFromConnectionGroupSet()
    {
        var database = new Mock<IDatabase>();
        var redis = new Mock<IConnectionMultiplexer>();
        redis.SetupGet(x => x.IsConnected).Returns(true);
        redis.Setup(x => x.GetDatabase(It.IsAny<int>(), It.IsAny<object?>())).Returns(database.Object);
        database.Setup(x => x.SetRemoveAsync(It.IsAny<RedisKey>(), It.IsAny<RedisValue>(), It.IsAny<CommandFlags>()))
            .ReturnsAsync(true);

        var policy = new RedisSeatHubAdmissionPolicy(redis.Object);
        var eventId = Guid.NewGuid();

        var removed = await policy.LeaveGroupAsync("connection-1", eventId);

        removed.Should().BeTrue();
        database.Verify(x => x.SetRemoveAsync(
            "tickex:seat-hub:groups:connection-1",
            eventId.ToString("N"),
            CommandFlags.None), Times.Once);
    }
}

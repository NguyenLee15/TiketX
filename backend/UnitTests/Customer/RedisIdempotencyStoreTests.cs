using FluentAssertions;
using Moq;
using StackExchange.Redis;
using TickeX.Infrastructure.Services;
using Xunit;

namespace TickeX.UnitTests.Customer;

public sealed class RedisIdempotencyStoreTests
{
    [Fact]
    public async Task DisconnectedRedis_FailsClosedInsteadOfClaimingLocally()
    {
        var redis = new Mock<IConnectionMultiplexer>();
        redis.SetupGet(x => x.IsConnected).Returns(false);
        var store = new RedisIdempotencyStore(redis.Object);

        var act = () => store.TryClaimAsync("idempotency-test", "{}", TimeSpan.FromHours(24), CancellationToken.None);

        await act.Should().ThrowAsync<RedisConnectionException>();
    }

    [Fact]
    public async Task IndependentRedisClients_OnlyOneClaimSucceedsAndCompletedRecordReplays()
    {
        var connection = Environment.GetEnvironmentVariable("REDIS_TEST_CONNECTION");
        if (string.IsNullOrWhiteSpace(connection)) return;
        using var clientA = await ConnectionMultiplexer.ConnectAsync(connection);
        using var clientB = await ConnectionMultiplexer.ConnectAsync(connection);
        var storeA = new RedisIdempotencyStore(clientA);
        var storeB = new RedisIdempotencyStore(clientB);
        var key = $"idempotency-test:{Guid.NewGuid():N}";
        var processing = "{\"Status\":\"Processing\",\"Fingerprint\":\"body-a\"}";

        var claims = await Task.WhenAll(
            storeA.TryClaimAsync(key, processing, TimeSpan.FromMinutes(1), CancellationToken.None),
            storeB.TryClaimAsync(key, processing, TimeSpan.FromMinutes(1), CancellationToken.None));

        claims.Count(x => x.Acquired).Should().Be(1);
        var owner = claims.Single(x => x.Acquired);
        var completed = "{\"Status\":\"Completed\",\"Fingerprint\":\"body-a\",\"StatusCode\":200,\"Body\":\"{}\"}";
        var ownerStore = claims[0].Acquired ? storeA : storeB;
        await ownerStore.CompleteAsync(key, owner.OwnerToken, completed, TimeSpan.FromMinutes(1), CancellationToken.None);

        var replay = await storeB.TryClaimAsync(key, processing, TimeSpan.FromMinutes(1), CancellationToken.None);
        replay.Acquired.Should().BeFalse();
        replay.ExistingRecord.Should().Contain("Completed").And.Contain("body-a");
        await storeB.ReleaseAsync(key, replay.OwnerToken, CancellationToken.None);
        (await clientA.GetDatabase().KeyExistsAsync(key)).Should().BeTrue("a non-owner cannot release the completed idempotency record");
        await clientA.GetDatabase().KeyDeleteAsync(key);
    }
}

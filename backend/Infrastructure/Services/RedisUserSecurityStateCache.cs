using System.Text.Json;
using StackExchange.Redis;
using TickeX.Application.Interfaces;

namespace TickeX.Infrastructure.Services;

public sealed class RedisUserSecurityStateCache(IConnectionMultiplexer redis) : IUserSecurityStateCache
{
    private static readonly TimeSpan Lifetime = TimeSpan.FromSeconds(30);
    private readonly IDatabase _database = redis.GetDatabase();

    public async Task<UserSecurityState?> GetAsync(Guid userId, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        try
        {
            var value = await _database.StringGetAsync(Key(userId));
            cancellationToken.ThrowIfCancellationRequested();
            return value.IsNullOrEmpty ? null : JsonSerializer.Deserialize<UserSecurityState>(value.ToString());
        }
        catch (RedisConnectionException)
        {
            return null;
        }
        catch (RedisTimeoutException)
        {
            return null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    public async Task SetAsync(Guid userId, UserSecurityState state, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        try
        {
            var payload = JsonSerializer.Serialize(state);
            await _database.StringSetAsync(Key(userId), payload, Lifetime);
        }
        catch (RedisConnectionException)
        {
            // Authentication always falls back to the authoritative database value.
        }
        catch (RedisTimeoutException)
        {
            // Authentication always falls back to the authoritative database value.
        }
    }

    private static RedisKey Key(Guid userId) => $"tickex:security-state:{userId:N}";
}

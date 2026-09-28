using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using StackExchange.Redis;
using TickeX.Application.Events.Queries;
using TickeX.Application.Interfaces;

namespace TickeX.Infrastructure.Services;

public sealed class RedisCustomerEventCatalogCache(IConnectionMultiplexer redis) : ICustomerEventCatalogCache
{
    private static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(45);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private const string VersionKey = "tickex:customer-catalog:version";

    public async Task<PagedResult<EventDto>?> GetAsync(GetEventsQuery request, CancellationToken cancellationToken = default)
    {
        if (!redis.IsConnected) return null;
        try
        {
            var database = redis.GetDatabase();
            var version = await database.StringGetAsync(VersionKey).WaitAsync(cancellationToken).ConfigureAwait(false);
            var payload = await database.StringGetAsync(Key(version.ToString(), request)).WaitAsync(cancellationToken).ConfigureAwait(false);
            return payload.HasValue ? JsonSerializer.Deserialize<PagedResult<EventDto>>(payload!, JsonOptions) : null;
        }
        catch (Exception ex) when (ex is RedisException or RedisTimeoutException or JsonException)
        {
            return null;
        }
    }

    public async Task SetAsync(GetEventsQuery request, PagedResult<EventDto> result, CancellationToken cancellationToken = default)
    {
        if (!redis.IsConnected) return;
        try
        {
            var database = redis.GetDatabase();
            var version = await database.StringGetAsync(VersionKey).WaitAsync(cancellationToken).ConfigureAwait(false);
            if (!version.HasValue)
            {
                await database.StringSetAsync(VersionKey, "1", expiry: null, when: When.NotExists).WaitAsync(cancellationToken).ConfigureAwait(false);
                version = await database.StringGetAsync(VersionKey).WaitAsync(cancellationToken).ConfigureAwait(false);
            }

            var payload = JsonSerializer.Serialize(result, JsonOptions);
            await database.StringSetAsync(Key(version.ToString(), request), payload, CacheTtl).WaitAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is RedisException or RedisTimeoutException or OperationCanceledException)
        {
            // Catalog caching is an optimization; the database remains authoritative.
        }
    }

    public async Task InvalidateAsync(CancellationToken cancellationToken = default)
    {
        if (!redis.IsConnected) return;
        try
        {
            await redis.GetDatabase().StringIncrementAsync(VersionKey).WaitAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is RedisException or RedisTimeoutException)
        {
            // Expiring entries remain safe; a cache outage must not fail the mutation.
        }
    }

    private static RedisKey Key(string version, GetEventsQuery request)
    {
        var canonical = string.Join('|',
            request.Search?.Trim().ToUpperInvariant() ?? string.Empty,
            request.Category?.Trim().ToUpperInvariant() ?? string.Empty,
            request.DateFrom?.ToUniversalTime().ToString("O", CultureInfo.InvariantCulture) ?? string.Empty,
            request.DateTo?.ToUniversalTime().ToString("O", CultureInfo.InvariantCulture) ?? string.Empty,
            request.SortBy?.Trim().ToLowerInvariant() ?? string.Empty,
            request.Cursor?.Trim() ?? string.Empty,
            request.Page.ToString(CultureInfo.InvariantCulture),
            request.PageSize.ToString(CultureInfo.InvariantCulture),
            request.Limit?.ToString(CultureInfo.InvariantCulture) ?? string.Empty);
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(canonical)));
        return $"tickex:customer-catalog:{version}:{hash}";
    }
}

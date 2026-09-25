using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace TickeX.WebApi.Filters;

[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = false, Inherited = false)]
public sealed class IdempotentAttribute : Attribute, IFilterFactory
{
    public int TtlSeconds { get; set; } = 86400; // 24 hours default
    public bool IsReusable => true;

    public IFilterMetadata CreateInstance(IServiceProvider serviceProvider)
    {
        var cache = serviceProvider.GetRequiredService<IDistributedCache>();
        var logger = serviceProvider.GetRequiredService<ILogger<IdempotencyFilter>>();
        var redis = serviceProvider.GetService<IConnectionMultiplexer>();
        return new IdempotencyFilter(cache, logger, redis, TtlSeconds);
    }
}

public sealed class IdempotencyRecord
{
    public string Status { get; set; } = "Processing"; // "Processing" | "Completed"
    public string Fingerprint { get; set; } = string.Empty;
    public int StatusCode { get; set; }
    public string? ContentType { get; set; }
    public string? Body { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public sealed class IdempotencyFilter : IAsyncActionFilter
{
    public const string HeaderName = "Idempotency-Key";
    public const string ReplayHeaderName = "Idempotency-Replay";

    private readonly IDistributedCache _cache;
    private readonly ILogger<IdempotencyFilter> _logger;
    private readonly IConnectionMultiplexer? _redis;
    private readonly int _ttlSeconds;

    public IdempotencyFilter(
        IDistributedCache cache,
        ILogger<IdempotencyFilter> logger,
        IConnectionMultiplexer? redis = null,
        int ttlSeconds = 86400)
    {
        _cache = cache;
        _logger = logger;
        _redis = redis;
        _ttlSeconds = ttlSeconds > 0 ? ttlSeconds : 86400;
    }

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        if (!context.HttpContext.Request.Headers.TryGetValue(HeaderName, out var rawValues) ||
            string.IsNullOrWhiteSpace(rawValues.FirstOrDefault()))
        {
            await next();
            return;
        }

        var keyString = rawValues.First()!.Trim();
        if (!Guid.TryParse(keyString, out var keyGuid))
        {
            context.Result = new BadRequestObjectResult(new
            {
                type = "https://tools.ietf.org/html/rfc9457",
                title = "Invalid Idempotency Key",
                status = StatusCodes.Status400BadRequest,
                success = false,
                code = "INVALID_IDEMPOTENCY_KEY",
                message = "Giá trị Idempotency-Key không hợp lệ. Vui lòng cung cấp UUIDv4 hợp lệ.",
                traceId = context.HttpContext.TraceIdentifier,
                instance = context.HttpContext.Request.Path.Value,
                error = new
                {
                    code = "INVALID_IDEMPOTENCY_KEY",
                    message = "Giá trị Idempotency-Key không hợp lệ. Vui lòng cung cấp UUIDv4 hợp lệ."
                }
            });
            return;
        }

        var userId = context.HttpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "anonymous";
        var cacheKey = $"idempotency:{userId}:{keyGuid:D}";
        var lockKey = $"idempotency:lock:{userId}:{keyGuid:D}";

        var method = context.HttpContext.Request.Method;
        var path = context.HttpContext.Request.Path.Value ?? string.Empty;
        var bodyHash = await ComputeBodyHashAsync(context.HttpContext.Request);
        var rawFingerprint = $"{userId}:{method}:{path}:{bodyHash}";
        var fingerprint = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawFingerprint)));

        // 1. Check existing record in cache
        IdempotencyRecord? existingRecord = null;
        try
        {
            var cachedJson = await _cache.GetStringAsync(cacheKey, context.HttpContext.RequestAborted);
            if (!string.IsNullOrEmpty(cachedJson))
            {
                existingRecord = JsonSerializer.Deserialize<IdempotencyRecord>(cachedJson);
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Failed to read idempotency cache for {CacheKey}", cacheKey);
        }

        if (existingRecord != null)
        {
            // Fingerprint mismatch detection: client reused key for different request payload
            if (!string.IsNullOrEmpty(existingRecord.Fingerprint) &&
                !string.Equals(existingRecord.Fingerprint, fingerprint, StringComparison.OrdinalIgnoreCase))
            {
                context.Result = new ObjectResult(new
                {
                    type = "https://tools.ietf.org/html/rfc9457",
                    title = "Idempotency Key Payload Mismatch",
                    status = StatusCodes.Status422UnprocessableEntity,
                    success = false,
                    code = "IDEMPOTENCY_PAYLOAD_MISMATCH",
                    message = "Khóa Idempotency-Key này đã được sử dụng cho một yêu cầu khác với nội dung khác.",
                    traceId = context.HttpContext.TraceIdentifier,
                    instance = context.HttpContext.Request.Path.Value,
                    error = new
                    {
                        code = "IDEMPOTENCY_PAYLOAD_MISMATCH",
                        message = "Khóa Idempotency-Key này đã được sử dụng cho một yêu cầu khác với nội dung khác."
                    }
                })
                {
                    StatusCode = StatusCodes.Status422UnprocessableEntity
                };
                return;
            }

            if (existingRecord.Status == "Processing")
            {
                context.Result = new ObjectResult(new
                {
                    type = "https://tools.ietf.org/html/rfc9457",
                    title = "Operation In Flight",
                    status = StatusCodes.Status409Conflict,
                    success = false,
                    code = "IDEMPOTENCY_IN_FLIGHT",
                    message = "Yêu cầu với Idempotency-Key này đang được xử lý. Vui lòng chờ kết quả.",
                    traceId = context.HttpContext.TraceIdentifier,
                    instance = context.HttpContext.Request.Path.Value,
                    error = new
                    {
                        code = "IDEMPOTENCY_IN_FLIGHT",
                        message = "Yêu cầu với Idempotency-Key này đang được xử lý. Vui lòng chờ kết quả."
                    }
                })
                {
                    StatusCode = StatusCodes.Status409Conflict
                };
                return;
            }

            if (existingRecord.Status == "Completed")
            {
                context.HttpContext.Response.Headers[ReplayHeaderName] = "true";
                context.Result = new ContentResult
                {
                    StatusCode = existingRecord.StatusCode,
                    ContentType = existingRecord.ContentType ?? "application/json",
                    Content = existingRecord.Body
                };
                return;
            }
        }

        // 2. Concurrency Gating: Try acquiring Redis distributed lock atomically (SETNX)
        string? lockToken = null;
        bool lockAcquired = false;

        if (_redis != null && _redis.IsConnected)
        {
            try
            {
                lockToken = Guid.NewGuid().ToString("N");
                lockAcquired = await _redis.GetDatabase().StringSetAsync(
                    lockKey,
                    lockToken,
                    TimeSpan.FromMinutes(2),
                    When.NotExists);

                if (!lockAcquired)
                {
                    context.Result = new ObjectResult(new
                    {
                        type = "https://tools.ietf.org/html/rfc9457",
                        title = "Operation In Flight",
                        status = StatusCodes.Status409Conflict,
                        success = false,
                        code = "IDEMPOTENCY_IN_FLIGHT",
                        message = "Yêu cầu với Idempotency-Key này đang được xử lý. Vui lòng chờ kết quả.",
                        traceId = context.HttpContext.TraceIdentifier,
                        instance = context.HttpContext.Request.Path.Value,
                        error = new
                        {
                            code = "IDEMPOTENCY_IN_FLIGHT",
                            message = "Yêu cầu với Idempotency-Key này đang được xử lý. Vui lòng chờ kết quả."
                        }
                    })
                    {
                        StatusCode = StatusCodes.Status409Conflict
                    };
                    return;
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "Failed to acquire Redis lock for key {LockKey}. Proceeding with distributed cache.", lockKey);
            }
        }

        // 3. Mark in-flight in cache
        try
        {
            var sentinel = new IdempotencyRecord
            {
                Status = "Processing",
                Fingerprint = fingerprint,
                CreatedAt = DateTime.UtcNow
            };
            await _cache.SetStringAsync(cacheKey, JsonSerializer.Serialize(sentinel), new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(2)
            }, context.HttpContext.RequestAborted);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Failed to record idempotency sentinel in cache for {CacheKey}", cacheKey);
        }

        // 4. Execute action pipeline
        ActionExecutedContext executedContext;
        try
        {
            executedContext = await next();
        }
        catch (Exception)
        {
            try { await _cache.RemoveAsync(cacheKey); } catch { /* Ignore */ }
            if (lockAcquired && lockToken != null)
            {
                await ReleaseLockSafeAsync(lockKey, lockToken);
            }
            throw;
        }

        if (executedContext.Exception != null && !executedContext.ExceptionHandled)
        {
            try { await _cache.RemoveAsync(cacheKey); } catch { /* Ignore */ }
            if (lockAcquired && lockToken != null)
            {
                await ReleaseLockSafeAsync(lockKey, lockToken);
            }
            return;
        }

        // 5. Cache result on 2xx or remove sentinel on failure
        try
        {
            if (executedContext.Result is ObjectResult objResult)
            {
                var statusCode = objResult.StatusCode ?? StatusCodes.Status200OK;
                if (statusCode is >= 200 and < 300)
                {
                    var completedRecord = new IdempotencyRecord
                    {
                        Status = "Completed",
                        Fingerprint = fingerprint,
                        StatusCode = statusCode,
                        ContentType = "application/json",
                        Body = JsonSerializer.Serialize(objResult.Value),
                        CreatedAt = DateTime.UtcNow
                    };
                    await _cache.SetStringAsync(cacheKey, JsonSerializer.Serialize(completedRecord), new DistributedCacheEntryOptions
                    {
                        AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(_ttlSeconds)
                    }, context.HttpContext.RequestAborted);
                }
                else
                {
                    await _cache.RemoveAsync(cacheKey);
                }
            }
            else if (executedContext.Result is StatusCodeResult statusResult)
            {
                if (statusResult.StatusCode is >= 200 and < 300)
                {
                    var completedRecord = new IdempotencyRecord
                    {
                        Status = "Completed",
                        Fingerprint = fingerprint,
                        StatusCode = statusResult.StatusCode,
                        ContentType = "application/json",
                        Body = "{}",
                        CreatedAt = DateTime.UtcNow
                    };
                    await _cache.SetStringAsync(cacheKey, JsonSerializer.Serialize(completedRecord), new DistributedCacheEntryOptions
                    {
                        AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(_ttlSeconds)
                    }, context.HttpContext.RequestAborted);
                }
                else
                {
                    await _cache.RemoveAsync(cacheKey);
                }
            }
            else
            {
                await _cache.RemoveAsync(cacheKey);
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Failed to cache idempotency result for key {CacheKey}", cacheKey);
        }
        finally
        {
            if (lockAcquired && lockToken != null)
            {
                await ReleaseLockSafeAsync(lockKey, lockToken);
            }
        }
    }

    private static async Task<string> ComputeBodyHashAsync(HttpRequest request)
    {
        if (!request.ContentLength.HasValue || request.ContentLength == 0)
            return string.Empty;

        request.EnableBuffering();
        request.Body.Position = 0;
        using var reader = new StreamReader(request.Body, Encoding.UTF8, detectEncodingFromByteOrderMarks: false, leaveOpen: true);
        var bodyText = await reader.ReadToEndAsync();
        request.Body.Position = 0;

        if (string.IsNullOrWhiteSpace(bodyText))
            return string.Empty;

        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(bodyText)));
    }

    private async Task ReleaseLockSafeAsync(string lockKey, string lockToken)
    {
        if (_redis == null || !_redis.IsConnected) return;
        const string compareAndDelete = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";
        try
        {
            await _redis.GetDatabase().ScriptEvaluateAsync(
                compareAndDelete,
                new RedisKey[] { lockKey },
                new RedisValue[] { lockToken });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to safely release idempotency lock {LockKey}", lockKey);
        }
    }
}


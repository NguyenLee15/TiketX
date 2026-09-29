using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using TickeX.Application.Interfaces;

namespace TickeX.WebApi.Filters;

[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = false, Inherited = false)]
public sealed class IdempotentAttribute : Attribute, IFilterFactory
{
    public int TtlSeconds { get; set; } = 86400;
    public bool Required { get; set; } = true;
    public bool FailClosed { get; set; } = true;
    public bool IsReusable => true;

    public IFilterMetadata CreateInstance(IServiceProvider serviceProvider) =>
        new IdempotencyFilter(serviceProvider.GetRequiredService<IIdempotencyStore>(),
            serviceProvider.GetRequiredService<ILogger<IdempotencyFilter>>(), TtlSeconds, Required, FailClosed);
}

public sealed class IdempotencyRecord
{
    public string Status { get; set; } = "Processing";
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
    private readonly IIdempotencyStore _store;
    private readonly ILogger<IdempotencyFilter> _logger;
    private readonly int _ttlSeconds;
    private readonly bool _required;
    private readonly bool _failClosed;

    public IdempotencyFilter(IIdempotencyStore store, ILogger<IdempotencyFilter> logger, int ttlSeconds = 86400, bool required = true, bool failClosed = true)
    {
        _store = store;
        _logger = logger;
        _ttlSeconds = ttlSeconds > 0 ? ttlSeconds : 86400;
        _required = required;
        _failClosed = failClosed;
    }

    private static bool IsValidUuidV4(string input, out Guid guid)
    {
        if (Guid.TryParseExact(input, "D", out guid) && input.Length == 36 && input[14] == '4' && input[19] is '8' or '9' or 'a' or 'b' or 'A' or 'B') return true;
        guid = Guid.Empty;
        return false;
    }

    private static ObjectResult Error(HttpContext context, int status, string code, string title, string message) => new(new
    {
        type = "https://tools.ietf.org/html/rfc9457", title, status, success = false, code, message,
        traceId = context.TraceIdentifier, instance = context.Request.Path.Value,
        error = new { code, message }
    }) { StatusCode = status };

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var http = context.HttpContext;
        if (!http.Request.Headers.TryGetValue(HeaderName, out var rawValues) || string.IsNullOrWhiteSpace(rawValues.FirstOrDefault()))
        {
            if (_required) context.Result = Error(http, 400, "MISSING_IDEMPOTENCY_KEY", "Missing Idempotency Key", "Thao tác này yêu cầu header Idempotency-Key (UUIDv4) để đảm bảo an toàn giao dịch.");
            else await next();
            return;
        }

        var keyString = rawValues.First()!.Trim();
        if (!IsValidUuidV4(keyString, out var keyGuid))
        {
            context.Result = Error(http, 400, "INVALID_IDEMPOTENCY_KEY", "Invalid Idempotency Key", "Giá trị Idempotency-Key không hợp lệ. Vui lòng cung cấp UUIDv4 hợp lệ.");
            return;
        }

        var userId = http.User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "anonymous";
        var method = http.Request.Method;
        var path = http.Request.Path.Value ?? string.Empty;
        var bodyHash = await ComputeBodyHashAsync(http.Request);
        var fingerprint = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"{userId}:{method}:{path}:{http.Request.QueryString}:{bodyHash}")));
        var key = $"tickex:idempotency:{userId}:{method}:{path}:{keyGuid:D}";
        var sentinel = JsonSerializer.Serialize(new IdempotencyRecord { Status = "Processing", Fingerprint = fingerprint });
        IdempotencyClaim claim;
        try { claim = await _store.TryClaimAsync(key, sentinel, TimeSpan.FromSeconds(_ttlSeconds), http.RequestAborted); }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Idempotency storage claim failed for request {TraceId}", http.TraceIdentifier);
            if (_failClosed) context.Result = Error(http, 503, "IDEMPOTENCY_STORAGE_UNAVAILABLE", "Idempotency Storage Unavailable", "Hệ thống bảo đảm an toàn giao dịch tạm thời không khả dụng. Vui lòng thử lại sau.");
            else await next();
            return;
        }

        if (!claim.Acquired)
        {
            var existingJson = claim.ExistingRecord?.Split('\n', 2).ElementAtOrDefault(1);
            var existing = existingJson is null ? null : JsonSerializer.Deserialize<IdempotencyRecord>(existingJson);
            if (existing is not null && !string.Equals(existing.Fingerprint, fingerprint, StringComparison.OrdinalIgnoreCase))
                context.Result = Error(http, 422, "IDEMPOTENCY_PAYLOAD_MISMATCH", "Idempotency Key Payload Mismatch", "Khóa Idempotency-Key này đã được sử dụng cho một yêu cầu khác với nội dung khác.");
            else if (existing?.Status == "Completed")
            {
                http.Response.Headers[ReplayHeaderName] = "true";
                context.Result = new ContentResult { StatusCode = existing.StatusCode, ContentType = existing.ContentType ?? "application/json", Content = existing.Body };
            }
            else
                context.Result = Error(http, 409, "IDEMPOTENCY_IN_FLIGHT", "Operation In Flight", "Yêu cầu với Idempotency-Key này đang được xử lý. Vui lòng chờ kết quả.");
            return;
        }

        ActionExecutedContext executed;
        try { executed = await next(); }
        catch
        {
            await ReleaseClaimSafeAsync(key, claim.OwnerToken, CancellationToken.None);
            throw;
        }

        if (executed.Exception != null && !executed.ExceptionHandled)
        {
            await ReleaseClaimSafeAsync(key, claim.OwnerToken, CancellationToken.None);
            return;
        }

        IdempotencyRecord? completed = executed.Result switch
        {
            ObjectResult result when (result.StatusCode ?? 200) is >= 200 and < 300 => new IdempotencyRecord
            {
                Status = "Completed", Fingerprint = fingerprint, StatusCode = result.StatusCode ?? 200,
                ContentType = "application/json", Body = JsonSerializer.Serialize(result.Value)
            },
            StatusCodeResult result when result.StatusCode is >= 200 and < 300 => new IdempotencyRecord
            {
                Status = "Completed", Fingerprint = fingerprint, StatusCode = result.StatusCode, ContentType = "application/json", Body = "{}"
            },
            _ => null
        };

        try
        {
            if (completed is null) await _store.ReleaseAsync(key, claim.OwnerToken, CancellationToken.None);
            else await _store.CompleteAsync(key, claim.OwnerToken, JsonSerializer.Serialize(completed), TimeSpan.FromSeconds(_ttlSeconds), CancellationToken.None);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Idempotency result could not be persisted after action completion for request {TraceId}", http.TraceIdentifier);
        }
    }

    private static async Task<string> ComputeBodyHashAsync(HttpRequest request)
    {
        if (request.ContentLength == 0) return string.Empty;
        request.EnableBuffering();
        request.Body.Position = 0;
        using var reader = new StreamReader(request.Body, Encoding.UTF8, false, leaveOpen: true);
        var bodyText = await reader.ReadToEndAsync();
        request.Body.Position = 0;
        return string.IsNullOrWhiteSpace(bodyText) ? string.Empty : Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(bodyText)));
    }

    private async Task ReleaseClaimSafeAsync(string key, string ownerToken, CancellationToken cancellationToken)
    {
        try { await _store.ReleaseAsync(key, ownerToken, cancellationToken); }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Could not release an idempotency claim.");
        }
    }
}

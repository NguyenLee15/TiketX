using System.Net;
using System.Text.Json;
using FluentValidation;

namespace TickeX.WebApi.Middleware;

public class GlobalExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionMiddleware> _logger;

    public GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (ValidationException ex)
        {
            _logger.LogWarning(ex, "Validation error occurred at {Path} (TraceId: {TraceId})", context.Request.Path, context.TraceIdentifier);
            context.Response.ContentType = "application/problem+json";
            context.Response.StatusCode = (int)HttpStatusCode.BadRequest;

            var fieldErrors = ex.Errors
                .GroupBy(e => string.IsNullOrWhiteSpace(e.PropertyName) ? "general" : e.PropertyName)
                .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).Distinct().ToArray());

            var flatErrors = ex.Errors.Select(e => e.ErrorMessage).Distinct().ToList();

            var response = new
            {
                type = "https://tools.ietf.org/html/rfc9457",
                title = "Validation Failed",
                status = (int)HttpStatusCode.BadRequest,
                success = false,
                message = "Dữ liệu đầu vào không hợp lệ.",
                code = "VALIDATION_FAILED",
                traceId = context.TraceIdentifier,
                instance = context.Request.Path.Value,
                errors = flatErrors,
                fieldErrors,
                error = new
                {
                    code = "VALIDATION_FAILED",
                    message = "Dữ liệu đầu vào không hợp lệ.",
                    traceId = context.TraceIdentifier,
                    details = flatErrors,
                    fieldErrors
                }
            };

            await context.Response.WriteAsync(JsonSerializer.Serialize(response));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An unhandled exception occurred at {Path} (TraceId: {TraceId}): {Message}",
                context.Request.Path, context.TraceIdentifier, ex.Message);
            context.Response.ContentType = "application/problem+json";
            context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;

            var response = new
            {
                type = "https://tools.ietf.org/html/rfc9457",
                title = "Internal Server Error",
                status = (int)HttpStatusCode.InternalServerError,
                success = false,
                message = "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.",
                code = "INTERNAL_ERROR",
                traceId = context.TraceIdentifier,
                instance = context.Request.Path.Value,
                errors = new[] { "Internal server error." },
                error = new
                {
                    code = "INTERNAL_ERROR",
                    message = "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.",
                    traceId = context.TraceIdentifier,
                    details = (object?)null
                }
            };

            await context.Response.WriteAsync(JsonSerializer.Serialize(response));
        }
    }
}

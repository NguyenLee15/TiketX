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
            _logger.LogWarning(ex, "Validation error occurred: {Path}", context.Request.Path);
            context.Response.ContentType = "application/json";
            context.Response.StatusCode = (int)HttpStatusCode.BadRequest;

            var errors = ex.Errors.Select(e => e.ErrorMessage).Distinct().ToList();
            var response = new
            {
                success = false,
                message = "Dữ liệu đầu vào không hợp lệ.",
                code = "VALIDATION_FAILED",
                errors,
                error = new { code = "VALIDATION_FAILED", message = "Dữ liệu đầu vào không hợp lệ.", details = errors }
            };

            await context.Response.WriteAsync(JsonSerializer.Serialize(response));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An unhandled exception occurred: {Message}", ex.Message);
            context.Response.ContentType = "application/json";
            context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;

            var response = new
            {
                success = false,
                message = "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.",
                code = "INTERNAL_ERROR",
                errors = new[] { "Internal server error." },
                error = new { code = "INTERNAL_ERROR", message = "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.", details = (object?)null }
            };

            await context.Response.WriteAsync(JsonSerializer.Serialize(response));
        }
    }
}

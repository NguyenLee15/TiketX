using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using TickeX.Application.Interfaces;

namespace TickeX.WebApi.Configuration;

public static class RateLimitingExtensions
{
    public static IServiceCollection AddTickeXRateLimiting(this IServiceCollection services)
    {
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.OnRejected = async (context, token) =>
            {
                context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                context.HttpContext.Response.Headers.Append("Retry-After", "60");
                context.HttpContext.Response.ContentType = "application/json";
                await context.HttpContext.Response.WriteAsJsonAsync(new
                {
                    success = false,
                    code = "TOO_MANY_REQUESTS",
                    message = "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút.",
                    error = new { code = "TOO_MANY_REQUESTS", message = "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút.", details = (object?)null }
                }, token);
            };

            AddPolicy(options, "AuthPolicy", 15);
            AddPolicy(options, "BookingPolicy", 30);
            AddPolicy(options, "AdminPolicy", 60);
        });

        return services;
    }

    private static void AddPolicy(RateLimiterOptions options, string name, int permitLimit)
    {
        options.AddPolicy(name, httpContext =>
        {
            var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var clientIp = httpContext.Connection.RemoteIpAddress?.ToString();
            var partitionKey = httpContext.RequestServices.GetRequiredService<IClientIdentityResolver>()
                .Resolve(userId, clientIp);
            return RateLimitPartition.GetFixedWindowLimiter(partitionKey, _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = permitLimit,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            });
        });
    }
}

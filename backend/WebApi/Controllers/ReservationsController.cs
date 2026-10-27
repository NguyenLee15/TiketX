using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using TickeX.Application.Interfaces;
using TickeX.WebApi.Filters;

namespace TickeX.WebApi.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
[EnableRateLimiting("BookingPolicy")]
public sealed class ReservationsController : ControllerBase
{
    private readonly IReservationOperations _operations;
    public ReservationsController(IReservationOperations operations) => _operations = operations;

    public sealed record ReleaseReservationRequest(string? Reason);

    [HttpPost("{ticketId:guid}/release")]
    [Idempotent]
    public async Task<IActionResult> Release(Guid ticketId, [FromBody] ReleaseReservationRequest? request, CancellationToken cancellationToken = default)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            return Unauthorized(new 
            { 
                type = "https://tools.ietf.org/html/rfc9457",
                title = "Unauthorized",
                status = StatusCodes.Status401Unauthorized,
                success = false, 
                code = "UNAUTHORIZED", 
                message = "User is not authenticated.",
                detail = "User is not authenticated.",
                instance = HttpContext.Request.Path.Value,
                traceId = HttpContext.TraceIdentifier,
                error = new { code = "UNAUTHORIZED", message = "User is not authenticated." }
            });
        var result = await _operations.ReleaseAsync(ticketId, userId, request?.Reason ?? "Customer cancelled checkout", cancellationToken);
        if (!result.Success)
        {
            var status = result.Code switch
            {
                "RESERVATION_FORBIDDEN" => StatusCodes.Status403Forbidden,
                "RESERVATION_NOT_FOUND" => StatusCodes.Status404NotFound,
                "RESERVATION_LOCK_UNAVAILABLE" => StatusCodes.Status503ServiceUnavailable,
                _ => StatusCodes.Status409Conflict
            };
            return StatusCode(status, new 
            { 
                type = "https://tools.ietf.org/html/rfc9457",
                title = result.Code,
                status,
                success = false, 
                code = result.Code, 
                message = result.Message,
                detail = result.Message,
                instance = HttpContext.Request.Path.Value,
                traceId = HttpContext.TraceIdentifier,
                error = new { code = result.Code, message = result.Message }
            });
        }
        return Ok(new { success = true, code = result.Code, message = result.Message });
    }
}

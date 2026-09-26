using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TickeX.Application.Interfaces;

namespace TickeX.WebApi.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class ReservationsController : ControllerBase
{
    private readonly IReservationOperations _operations;
    public ReservationsController(IReservationOperations operations) => _operations = operations;

    public sealed record ReleaseReservationRequest(string? Reason);

    [HttpPost("{ticketId:guid}/release")]
    public async Task<IActionResult> Release(Guid ticketId, [FromBody] ReleaseReservationRequest? request, CancellationToken cancellationToken = default)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            return Unauthorized(new 
            { 
                success = false, 
                code = "UNAUTHORIZED", 
                message = "User is not authenticated.",
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
                "RESERVATION_LOCK_LOST" => StatusCodes.Status503ServiceUnavailable,
                "RESERVATION_PROVIDER_UNKNOWN" => StatusCodes.Status503ServiceUnavailable,
                _ => StatusCodes.Status409Conflict
            };
            return StatusCode(status, new 
            { 
                success = false, 
                code = result.Code, 
                message = result.Message,
                error = new { code = result.Code, message = result.Message }
            });
        }
        return Ok(new { success = true, code = result.Code, message = result.Message });
    }
}

using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using TickeX.Application.Seats.Commands;

namespace TickeX.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("BookingPolicy")]
public class SeatsController : ControllerBase
{
    private readonly IMediator _mediator;

    public SeatsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    public record LockSeatRequest(Guid EventId, string Version, Guid? UserId = null);

    [Authorize]
    [HttpPost("{id}/lock")]
    public async Task<IActionResult> LockSeat(Guid id, [FromBody] LockSeatRequest request)
    {
        var userIdString = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userIdString) || !Guid.TryParse(userIdString, out var currentUserId))
        {
            return Unauthorized(new 
            { 
                success = false, 
                code = "UNAUTHORIZED", 
                message = "User is not authenticated.",
                error = new { code = "UNAUTHORIZED", message = "User is not authenticated." }
            });
        }

        byte[] versionBytes;
        try
        {
            versionBytes = Convert.FromBase64String(request.Version);
        }
        catch (FormatException)
        {
            return BadRequest(new 
            { 
                success = false, 
                code = "INVALID_SEAT_VERSION", 
                message = "Invalid seat version token format. Valid Base64 string is required.",
                error = new { code = "INVALID_SEAT_VERSION", message = "Invalid seat version token format. Valid Base64 string is required." }
            });
        }
        if (versionBytes.Length != 16)
        {
            return BadRequest(new 
            { 
                success = false, 
                code = "INVALID_SEAT_VERSION", 
                message = "Invalid seat version token length.",
                error = new { code = "INVALID_SEAT_VERSION", message = "Invalid seat version token length." }
            });
        }

        var command = new LockSeatCommand(request.EventId, id, currentUserId, versionBytes);
        var lockResult = await _mediator.Send(command);

        if (!lockResult.Success)
        {
            var statusCode = lockResult.Code == "SEAT_VERSION_CONFLICT"
                ? StatusCodes.Status409Conflict
                : lockResult.Code == "RESERVATION_LOCK_UNAVAILABLE"
                    ? StatusCodes.Status503ServiceUnavailable
                    : StatusCodes.Status400BadRequest;
            return StatusCode(statusCode, new 
            { 
                success = false, 
                code = lockResult.Code, 
                message = lockResult.Message,
                error = new { code = lockResult.Code, message = lockResult.Message }
            });
        }

        return StatusCode(StatusCodes.Status201Created, new 
        { 
            success = true, 
            data = new 
            { 
                ticketId = lockResult.TicketId,
                expiresAt = lockResult.ExpiresAt
            }, 
            code = lockResult.Code,
            message = lockResult.Message
        });
    }
}

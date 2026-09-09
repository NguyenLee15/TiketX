using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using TickeX.Application.Tickets.Commands;
using TickeX.Application.Tickets.Queries;
using TickeX.Application.Interfaces;

namespace TickeX.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TicketsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ICheckInOperations _checkInOperations;

    public TicketsController(IMediator mediator, ICheckInOperations checkInOperations)
    {
        _mediator = mediator;
        _checkInOperations = checkInOperations;
    }

    [HttpGet("my-tickets")]
    public async Task<IActionResult> GetMyTickets()
    {
        var userIdString = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userIdString) || !Guid.TryParse(userIdString, out var userId))
        {
            return Unauthorized();
        }

        var result = await _mediator.Send(new GetMyTicketsQuery(userId));
        return Ok(new { success = true, data = result });
    }

    public record RefundRequest(string? Reason);

    [HttpPost("{id}/refund")]
    public async Task<IActionResult> RefundTicket(Guid id, [FromBody] RefundRequest? request)
    {
        var userIdString = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userIdString) || !Guid.TryParse(userIdString, out var userId))
        {
            return Unauthorized();
        }

        var command = new RefundTicketCommand(
            id,
            userId,
            request?.Reason ?? "Customer Request",
            User.FindFirstValue(ClaimTypes.Email) ?? "",
            HttpContext.Connection.RemoteIpAddress?.ToString());
        var result = await _mediator.Send(command, HttpContext.RequestAborted);

        if (!result.Success)
        {
            var statusCode = result.Code switch
            {
                "REFUND_LOCK_UNAVAILABLE" => StatusCodes.Status503ServiceUnavailable,
                "REFUND_CONCURRENCY_CONFLICT" => StatusCodes.Status409Conflict,
                "REFUND_TICKET_NOT_FOUND" or "REFUND_EVENT_NOT_FOUND" => StatusCodes.Status404NotFound,
                "REFUND_FORBIDDEN" => StatusCodes.Status403Forbidden,
                "REFUND_TICKET_USED" or "REFUND_ALREADY_CANCELLED" or "REFUND_TICKET_NOT_PAID" or "REFUND_CUTOFF_EXPIRED" => StatusCodes.Status409Conflict,
                _ => StatusCodes.Status400BadRequest
            };

            return StatusCode(statusCode, new
            {
                success = false,
                code = result.Code,
                message = result.Message
            });
        }

        return Ok(new { success = true, code = result.Code, message = result.Message, data = new { refundAmount = result.RefundAmount } });
    }

    public record CheckInRequest(string QrToken);

    [HttpPost("check-in")]
    [Authorize(Roles = "Admin,Staff")]
    [EnableRateLimiting("BookingPolicy")]
    public async Task<IActionResult> CheckIn([FromBody] CheckInRequest request)
    {
        var staffUserIdString = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(staffUserIdString) || !Guid.TryParse(staffUserIdString, out var staffUserId))
        {
            return Unauthorized(new { success = false, message = "Không xác định được danh tính nhân viên từ token." });
        }

        var callerRole = User.FindFirstValue(ClaimTypes.Role) ?? "Staff";
        var staffEmail = User.FindFirstValue(ClaimTypes.Email) ?? "staff@tickex.com";
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();

        var command = new CheckInTicketCommand(request.QrToken, staffUserId, callerRole, staffEmail, ipAddress);
        var result = await _checkInOperations.CheckInAsync(command, HttpContext.RequestAborted);

        if (!result.Success)
        {
            return StatusCode(result.StatusCode, new { success = false, code = result.Code, message = result.Message });
        }

        return Ok(new { success = true, message = result.Message, data = result.Ticket });
    }
}

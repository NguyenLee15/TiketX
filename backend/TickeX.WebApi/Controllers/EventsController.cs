using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using TickeX.Application.Events.Queries;
using TickeX.Application.Events.Commands;
using TickeX.Application.Interfaces;

namespace TickeX.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class EventsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IAdminEventOperations _adminEventOperations;

    public EventsController(IMediator mediator, IAdminEventOperations adminEventOperations)
    {
        _mediator = mediator;
        _adminEventOperations = adminEventOperations;
    }

    [AllowAnonymous]
    [HttpGet]
    [EnableRateLimiting("PublicCatalogPolicy")]
    public async Task<IActionResult> GetEvents([FromQuery] GetEventsQuery query, CancellationToken cancellationToken = default)
    {
        var result = await _mediator.Send(query, cancellationToken);
        return Ok(new { success = true, data = result });
    }

    [HttpGet("admin-all")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAdminEvents([FromQuery] GetAdminEventsQuery query, CancellationToken cancellationToken = default)
    {
        var result = await _mediator.Send(query, cancellationToken);
        return Ok(new { success = true, data = result });
    }

    [AllowAnonymous]
    [HttpGet("{id}")]
    [EnableRateLimiting("PublicCatalogPolicy")]
    public async Task<IActionResult> GetEvent(Guid id, CancellationToken cancellationToken = default)
    {
        Guid? currentUserId = null;
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (Guid.TryParse(userIdStr, out var parsedId))
        {
            currentUserId = parsedId;
        }

        var result = await _mediator.Send(new GetEventWithSeatsQuery(id, currentUserId), cancellationToken);
        if (result == null) 
            return NotFound(new 
            { 
                success = false, 
                code = "EVENT_NOT_FOUND", 
                message = "Event not found",
                error = new { code = "EVENT_NOT_FOUND", message = "Event not found" }
            });
        return Ok(new { success = true, data = result });
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    [EnableRateLimiting("AdminPolicy")]
    public async Task<IActionResult> CreateEvent([FromBody] CreateEventRequest? request, CancellationToken cancellationToken = default)
    {
        if (request is null)
            return BadRequest(new { success = false, code = "INVALID_REQUEST", message = "Thiếu dữ liệu sự kiện.", error = new { code = "INVALID_REQUEST", message = "Thiếu dữ liệu sự kiện." } });

        var adminUserIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        Guid.TryParse(adminUserIdStr, out var adminUserId);
        var adminEmail = User.FindFirstValue(ClaimTypes.Email) ?? "admin@tickex.com";
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();

        var command = new CreateEventCommand(
            request.Title,
            request.Description,
            request.Date,
            request.EndDate,
            request.Location,
            request.VenueName,
            request.TotalSeats,
            request.Category,
            request.ImageUrl,
            request.BannerUrl,
            request.OrganizerName,
            request.BasePrice,
            request.RefundCutoffHours,
            request.RowCount,
            request.SeatsPerRow,
            request.Status,
            adminUserId == Guid.Empty ? null : adminUserId,
            adminEmail,
            ipAddress);
        var id = await _adminEventOperations.CreateAsync(command, cancellationToken);
        return CreatedAtAction(nameof(GetEvent), new { id }, new { success = true, code = "CREATED", message = "Tạo sự kiện thành công.", data = new { id } });
    }

    public record CreateEventRequest(
        string Title,
        string Description,
        DateTime Date,
        DateTime EndDate,
        string Location,
        string VenueName,
        int TotalSeats,
        string Category,
        string ImageUrl,
        string BannerUrl = "",
        string OrganizerName = "TickeX Live",
        decimal BasePrice = 200000m,
        int RefundCutoffHours = 24,
        int RowCount = 5,
        int SeatsPerRow = 12,
        TickeX.Domain.Enums.EventStatus Status = TickeX.Domain.Enums.EventStatus.Published);

    public record UpdateEventRequest(
        Guid? Id,
        string Title,
        string Description,
        DateTime Date,
        DateTime EndDate,
        string Location,
        string VenueName,
        int TotalSeats,
        string Category,
        string ImageUrl,
        string BannerUrl = "",
        string OrganizerName = "TickeX Live",
        decimal BasePrice = 200000m,
        TickeX.Domain.Enums.EventStatus Status = TickeX.Domain.Enums.EventStatus.Published,
        int RefundCutoffHours = 24,
        string? ExpectedVersion = null);

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    [EnableRateLimiting("AdminPolicy")]
    public async Task<IActionResult> UpdateEvent(Guid id, [FromBody] UpdateEventRequest? request, CancellationToken cancellationToken = default)
    {
        if (request is null)
            return BadRequest(new { success = false, code = "INVALID_REQUEST", message = "Thiếu dữ liệu cập nhật sự kiện.", error = new { code = "INVALID_REQUEST", message = "Thiếu dữ liệu cập nhật sự kiện." } });
        if (request.Id.HasValue && id != request.Id.Value)
            return BadRequest(new { success = false, code = "ID_MISMATCH", message = "Định danh sự kiện không trùng khớp.", error = new { code = "ID_MISMATCH", message = "Định danh sự kiện không trùng khớp." } });

        var adminUserIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        Guid.TryParse(adminUserIdStr, out var adminUserId);
        var adminEmail = User.FindFirstValue(ClaimTypes.Email) ?? "admin@tickex.com";
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();

        var result = await _adminEventOperations.UpdateAsync(new UpdateEventCommand(
            id,
            request.Title,
            request.Description,
            request.Date,
            request.EndDate,
            request.Location,
            request.VenueName,
            request.TotalSeats,
            request.Category,
            request.ImageUrl,
            request.BannerUrl,
            request.OrganizerName,
            request.BasePrice,
            request.Status,
            request.RefundCutoffHours,
            adminUserId == Guid.Empty ? null : adminUserId,
            adminEmail,
            ipAddress,
            request.ExpectedVersion), cancellationToken);

        if (!result.Success)
            return StatusCode(result.StatusCode, new { success = false, code = result.ErrorCode, message = result.Message, error = new { code = result.ErrorCode, message = result.Message } });

        return Ok(new { success = true, code = "OK", message = result.Message, data = (object?)null });
    }

    public record CancelEventRequest(string Reason);

    [HttpPost("{id}/cancel")]
    [Authorize(Roles = "Admin")]
    [EnableRateLimiting("AdminPolicy")]
    public async Task<IActionResult> CancelEvent(Guid id, [FromBody] CancelEventRequest? request, CancellationToken cancellationToken = default)
    {
        if (request is null)
            return BadRequest(new { success = false, code = "INVALID_REQUEST", message = "Thiếu lý do hủy sự kiện.", error = new { code = "INVALID_REQUEST", message = "Thiếu lý do hủy sự kiện." } });
        var adminUserIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        Guid.TryParse(adminUserIdStr, out var adminUserId);
        var adminEmail = User.FindFirstValue(ClaimTypes.Email) ?? "admin@tickex.com";
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();

        var result = await _adminEventOperations.CancelAsync(new CancelEventCommand(id, request.Reason, adminUserId, adminEmail, ipAddress), cancellationToken);
        if (!result.Success)
            return StatusCode(result.StatusCode, new { success = false, code = result.ErrorCode, message = result.Message, error = new { code = result.ErrorCode, message = result.Message } });

        return Ok(new { success = true, code = "OK", message = result.Message, data = (object?)null });
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    [EnableRateLimiting("AdminPolicy")]
    public async Task<IActionResult> DeleteEvent(Guid id, CancellationToken cancellationToken = default)
    {
        var adminUserIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        Guid.TryParse(adminUserIdStr, out var adminUserId);
        var adminEmail = User.FindFirstValue(ClaimTypes.Email) ?? "admin@tickex.com";
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();

        var result = await _adminEventOperations.DeleteAsync(new DeleteEventCommand(id, adminUserId, adminEmail, ipAddress), cancellationToken);
        if (!result.Success)
            return StatusCode(result.StatusCode, new { success = false, code = result.ErrorCode, message = result.Message, error = new { code = result.ErrorCode, message = result.Message } });

        return Ok(new { success = true, code = "OK", message = result.Message, data = (object?)null });
    }
}

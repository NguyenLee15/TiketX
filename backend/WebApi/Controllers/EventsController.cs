using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using TickeX.Application.Events.Queries;
using TickeX.Application.Events.Commands;
using TickeX.Application.Interfaces;
using TickeX.WebApi.Filters;

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
    [EnableRateLimiting("PublicReadPolicy")]
    public async Task<IActionResult> GetEvents([FromQuery] GetEventsQuery query, CancellationToken cancellationToken = default)
    {
        try
        {
            var result = await _mediator.Send(query, cancellationToken);
            return Ok(new { success = true, data = result });
        }
        catch (ArgumentException ex) when (query.Cursor is not null)
        {
            return BadRequest(new 
            { 
                type = "https://tools.ietf.org/html/rfc9457",
                title = "Invalid Cursor",
                status = StatusCodes.Status400BadRequest,
                success = false, 
                code = "INVALID_CURSOR", 
                message = ex.Message,
                detail = ex.Message,
                instance = HttpContext.Request.Path.Value,
                traceId = HttpContext.TraceIdentifier,
                error = new { code = "INVALID_CURSOR", message = ex.Message }
            });
        }
    }

    [HttpGet("admin-all")]
    [Authorize(Roles = "Admin")]
    [EnableRateLimiting("AdminPolicy")]
    public async Task<IActionResult> GetAdminEvents([FromQuery] GetAdminEventsQuery query, CancellationToken cancellationToken = default)
    {
        var result = await _mediator.Send(query, cancellationToken);
        return Ok(new { success = true, data = result });
    }

    [AllowAnonymous]
    [HttpGet("{id}")]
    [EnableRateLimiting("PublicReadPolicy")]
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
                type = "https://tools.ietf.org/html/rfc9457",
                title = "Event Not Found",
                status = StatusCodes.Status404NotFound,
                success = false, 
                code = "EVENT_NOT_FOUND", 
                message = "Event not found",
                detail = "Event not found",
                instance = HttpContext.Request.Path.Value,
                traceId = HttpContext.TraceIdentifier,
                error = new { code = "EVENT_NOT_FOUND", message = "Event not found" }
            });
        return Ok(new { success = true, data = result });
    }

    private IActionResult UnauthorizedEnvelope(string detail = "User is not authenticated.") => Unauthorized(new
    {
        type = "https://tools.ietf.org/html/rfc9457",
        title = "Unauthorized",
        status = StatusCodes.Status401Unauthorized,
        success = false,
        code = "UNAUTHORIZED",
        message = detail,
        detail,
        instance = HttpContext.Request.Path.Value,
        traceId = HttpContext.TraceIdentifier,
        error = new { code = "UNAUTHORIZED", message = detail }
    });

    [HttpPost]
    [Idempotent]
    [Authorize(Roles = "Admin")]
    [EnableRateLimiting("AdminPolicy")]
    public async Task<IActionResult> CreateEvent([FromBody] CreateEventRequest? request, CancellationToken cancellationToken = default)
    {
        if (request is null)
            return BadRequest(new 
            { 
                type = "https://tools.ietf.org/html/rfc9457",
                title = "Invalid Request",
                status = StatusCodes.Status400BadRequest,
                success = false, 
                code = "INVALID_REQUEST", 
                message = "Thiếu dữ liệu sự kiện.", 
                detail = "Thiếu dữ liệu sự kiện.",
                instance = HttpContext.Request.Path.Value,
                traceId = HttpContext.TraceIdentifier,
                error = new { code = "INVALID_REQUEST", message = "Thiếu dữ liệu sự kiện." } 
            });

        var adminUserIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(adminUserIdStr) || !Guid.TryParse(adminUserIdStr, out var adminUserId) || adminUserId == Guid.Empty)
            return UnauthorizedEnvelope("Không xác định được danh tính quản trị viên từ token.");
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
            adminUserId,
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
    [Idempotent]
    [Authorize(Roles = "Admin")]
    [EnableRateLimiting("AdminPolicy")]
    public async Task<IActionResult> UpdateEvent(Guid id, [FromBody] UpdateEventRequest? request, CancellationToken cancellationToken = default)
    {
        if (request is null)
            return BadRequest(new 
            { 
                type = "https://tools.ietf.org/html/rfc9457",
                title = "Invalid Request",
                status = StatusCodes.Status400BadRequest,
                success = false, 
                code = "INVALID_REQUEST", 
                message = "Thiếu dữ liệu cập nhật sự kiện.", 
                detail = "Thiếu dữ liệu cập nhật sự kiện.",
                instance = HttpContext.Request.Path.Value,
                traceId = HttpContext.TraceIdentifier,
                error = new { code = "INVALID_REQUEST", message = "Thiếu dữ liệu cập nhật sự kiện." } 
            });
        if (request.Id.HasValue && id != request.Id.Value)
            return BadRequest(new 
            { 
                type = "https://tools.ietf.org/html/rfc9457",
                title = "Id Mismatch",
                status = StatusCodes.Status400BadRequest,
                success = false, 
                code = "ID_MISMATCH", 
                message = "Định danh sự kiện không trùng khớp.", 
                detail = "Định danh sự kiện không trùng khớp.",
                instance = HttpContext.Request.Path.Value,
                traceId = HttpContext.TraceIdentifier,
                error = new { code = "ID_MISMATCH", message = "Định danh sự kiện không trùng khớp." } 
            });

        var adminUserIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(adminUserIdStr) || !Guid.TryParse(adminUserIdStr, out var adminUserId) || adminUserId == Guid.Empty)
            return UnauthorizedEnvelope("Không xác định được danh tính quản trị viên từ token.");
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
            adminUserId,
            adminEmail,
            ipAddress,
            request.ExpectedVersion), cancellationToken);

        if (!result.Success)
            return StatusCode(result.StatusCode, new 
            { 
                type = "https://tools.ietf.org/html/rfc9457",
                title = result.ErrorCode,
                status = result.StatusCode,
                success = false, 
                code = result.ErrorCode, 
                message = result.Message, 
                detail = result.Message,
                instance = HttpContext.Request.Path.Value,
                traceId = HttpContext.TraceIdentifier,
                error = new { code = result.ErrorCode, message = result.Message } 
            });

        return Ok(new { success = true, code = "OK", message = result.Message, data = (object?)null });
    }

    public record CancelEventRequest(string Reason, string? ExpectedVersion = null);

    [HttpPost("{id}/cancel")]
    [Idempotent]
    [Authorize(Roles = "Admin")]
    [EnableRateLimiting("AdminPolicy")]
    public async Task<IActionResult> CancelEvent(Guid id, [FromBody] CancelEventRequest? request, CancellationToken cancellationToken = default)
    {
        if (request is null)
            return BadRequest(new 
            { 
                type = "https://tools.ietf.org/html/rfc9457",
                title = "Invalid Request",
                status = StatusCodes.Status400BadRequest,
                success = false, 
                code = "INVALID_REQUEST", 
                message = "Thiếu lý do hủy sự kiện.", 
                detail = "Thiếu lý do hủy sự kiện.",
                instance = HttpContext.Request.Path.Value,
                traceId = HttpContext.TraceIdentifier,
                error = new { code = "INVALID_REQUEST", message = "Thiếu lý do hủy sự kiện." } 
            });
        var adminUserIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(adminUserIdStr) || !Guid.TryParse(adminUserIdStr, out var adminUserId) || adminUserId == Guid.Empty)
            return UnauthorizedEnvelope("Không xác định được danh tính quản trị viên từ token.");
        var adminEmail = User.FindFirstValue(ClaimTypes.Email) ?? "admin@tickex.com";
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();

        var result = await _adminEventOperations.CancelAsync(new CancelEventCommand(
            id, request.Reason, request.ExpectedVersion, adminUserId, adminEmail, ipAddress), cancellationToken);
        if (!result.Success)
            return StatusCode(result.StatusCode, new 
            { 
                type = "https://tools.ietf.org/html/rfc9457",
                title = result.ErrorCode,
                status = result.StatusCode,
                success = false, 
                code = result.ErrorCode, 
                message = result.Message, 
                detail = result.Message,
                instance = HttpContext.Request.Path.Value,
                traceId = HttpContext.TraceIdentifier,
                error = new { code = result.ErrorCode, message = result.Message } 
            });

        return Ok(new { success = true, code = "OK", message = result.Message, data = (object?)null });
    }

    [HttpDelete("{id}")]
    [Idempotent]
    [Authorize(Roles = "Admin")]
    [EnableRateLimiting("AdminPolicy")]
    public async Task<IActionResult> DeleteEvent(Guid id, [FromQuery] string? expectedVersion = null, CancellationToken cancellationToken = default)
    {
        var adminUserIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(adminUserIdStr) || !Guid.TryParse(adminUserIdStr, out var adminUserId) || adminUserId == Guid.Empty)
            return UnauthorizedEnvelope("Không xác định được danh tính quản trị viên từ token.");
        var adminEmail = User.FindFirstValue(ClaimTypes.Email) ?? "admin@tickex.com";
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();

        var result = await _adminEventOperations.DeleteAsync(new DeleteEventCommand(id, adminUserId, adminEmail, ipAddress, expectedVersion), cancellationToken);
        if (!result.Success)
            return StatusCode(result.StatusCode, new 
            { 
                type = "https://tools.ietf.org/html/rfc9457",
                title = result.ErrorCode,
                status = result.StatusCode,
                success = false, 
                code = result.ErrorCode, 
                message = result.Message, 
                detail = result.Message,
                instance = HttpContext.Request.Path.Value,
                traceId = HttpContext.TraceIdentifier,
                error = new { code = result.ErrorCode, message = result.Message } 
            });

        return Ok(new { success = true, code = "OK", message = result.Message, data = (object?)null });
    }
}

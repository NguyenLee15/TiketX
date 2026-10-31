using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TickeX.Application.Admin;
using TickeX.Application.Admin.Commands;
using TickeX.Application.Admin.Queries;
using TickeX.Application.Interfaces;
using Microsoft.AspNetCore.RateLimiting;
using TickeX.WebApi.Filters;

namespace TickeX.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
[EnableRateLimiting("AdminPolicy")]
public class AdminController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IAdminUserOperations _adminUserOperations;

    public AdminController(IMediator mediator, IAdminUserOperations adminUserOperations)
    {
        _mediator = mediator;
        _adminUserOperations = adminUserOperations;
    }

    [HttpGet("stats")]
    public async Task<IActionResult> GetStats(CancellationToken cancellationToken = default)
    {
        var result = await _mediator.Send(new GetDashboardStatsQuery(), cancellationToken);
        return Ok(new { success = true, data = result });
    }

    [HttpGet("users")]
    public async Task<IActionResult> GetUsers([FromQuery] GetUsersQuery query, CancellationToken cancellationToken = default)
    {
        var result = await _mediator.Send(query, cancellationToken);
        return Ok(new { success = true, data = result });
    }

    [HttpGet("refunds")]
    public async Task<IActionResult> GetRefunds([FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken cancellationToken = default)
    {
        if (page < 1 || pageSize is < 1 or > 50 || ((long)page - 1) * pageSize > int.MaxValue)
            return BadRequest(new 
            { 
                type = "https://tools.ietf.org/html/rfc9457",
                title = "Pagination Out Of Range",
                status = StatusCodes.Status400BadRequest,
                success = false, 
                code = "PAGINATION_OUT_OF_RANGE", 
                message = "page phải dương và pageSize phải nằm trong khoảng 1–50.",
                detail = "page phải dương và pageSize phải nằm trong khoảng 1–50.",
                instance = HttpContext.Request.Path.Value,
                traceId = HttpContext.TraceIdentifier,
                error = new { code = "PAGINATION_OUT_OF_RANGE", message = "page phải dương và pageSize phải nằm trong khoảng 1–50." }
            });
        var result = await _mediator.Send(new GetRefundRequestsQuery(page, pageSize), cancellationToken);
        return Ok(new { success = true, data = result });
    }

    [HttpPost("refunds/{id:guid}/retries")]
    [Idempotent]
    public async Task<IActionResult> RetryRefund(Guid id, [FromQuery] string? expectedVersion = null, CancellationToken cancellationToken = default)
    {
        var result = await _mediator.Send(new RetryRefundRequestCommand(id, expectedVersion), cancellationToken);
        return result switch
        {
            "INVALID_VERSION" => BadRequest(new 
            { 
                type = "https://tools.ietf.org/html/rfc9457",
                title = "Invalid Version",
                status = StatusCodes.Status400BadRequest,
                success = false, 
                code = result, 
                message = "Phiên bản dữ liệu yêu cầu hoàn tiền không hợp lệ.",
                detail = "Phiên bản dữ liệu yêu cầu hoàn tiền không hợp lệ.",
                instance = HttpContext.Request.Path.Value,
                traceId = HttpContext.TraceIdentifier,
                error = new { code = result, message = "Phiên bản dữ liệu yêu cầu hoàn tiền không hợp lệ." }
            }),
            "REFUND_NOT_FOUND" => NotFound(new 
            { 
                type = "https://tools.ietf.org/html/rfc9457",
                title = "Refund Not Found",
                status = StatusCodes.Status404NotFound,
                success = false, 
                code = result, 
                message = "Không tìm thấy yêu cầu hoàn tiền.",
                detail = "Không tìm thấy yêu cầu hoàn tiền.",
                instance = HttpContext.Request.Path.Value,
                traceId = HttpContext.TraceIdentifier,
                error = new { code = result, message = "Không tìm thấy yêu cầu hoàn tiền." }
            }),
            "REFUND_RETRY_QUEUED" => Accepted(new { success = true, code = result }),
            "REFUND_COMPLETED" => Ok(new { success = true, code = result }),
            "REFUND_CONCURRENCY_CONFLICT" => StatusCode(StatusCodes.Status409Conflict, new 
            { 
                type = "https://tools.ietf.org/html/rfc9457",
                title = "Refund Concurrency Conflict",
                status = StatusCodes.Status409Conflict,
                success = false, 
                code = result, 
                message = "Yêu cầu hoàn tiền đang được xử lý đồng thời bởi tác vụ khác. Vui lòng tải lại dữ liệu mới nhất.",
                detail = "Yêu cầu hoàn tiền đang được xử lý đồng thời bởi tác vụ khác. Vui lòng tải lại dữ liệu mới nhất.",
                instance = HttpContext.Request.Path.Value,
                traceId = HttpContext.TraceIdentifier,
                error = new { code = result, message = "Yêu cầu hoàn tiền đang được xử lý đồng thời bởi tác vụ khác. Vui lòng tải lại dữ liệu mới nhất." }
            }),
            "REFUND_RECONCILIATION_LOCK_UNAVAILABLE" or "REFUND_RECONCILIATION_LOCK_LOST" => StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                type = "https://tools.ietf.org/html/rfc9457",
                title = "Service Unavailable",
                status = StatusCodes.Status503ServiceUnavailable,
                success = false,
                code = result,
                message = "Dịch vụ đối soát hoàn tiền đang bận hoặc gián đoạn kết nối. Vui lòng thử lại sau.",
                detail = "Dịch vụ đối soát hoàn tiền đang bận hoặc gián đoạn kết nối. Vui lòng thử lại sau.",
                instance = HttpContext.Request.Path.Value,
                traceId = HttpContext.TraceIdentifier,
                error = new { code = result, message = "Dịch vụ đối soát hoàn tiền đang bận hoặc gián đoạn kết nối. Vui lòng thử lại sau." }
            }),
            _ => Conflict(new 
            { 
                type = "https://tools.ietf.org/html/rfc9457",
                title = "Refund Conflict",
                status = StatusCodes.Status409Conflict,
                success = false, 
                code = result, 
                message = "Chưa thể retry cho đến khi trạng thái PayOS được đối soát.",
                detail = "Chưa thể retry cho đến khi trạng thái PayOS được đối soát.",
                instance = HttpContext.Request.Path.Value,
                traceId = HttpContext.TraceIdentifier,
                error = new { code = result, message = "Chưa thể retry cho đến khi trạng thái PayOS được đối soát." }
            })
        };
    }

    public record ChangeRoleRequest(string Role, string? ExpectedVersion = null);

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

    [HttpPut("users/{id}/role")]
    [Idempotent]
    public async Task<IActionResult> ChangeUserRole(Guid id, [FromBody] ChangeRoleRequest? request, CancellationToken cancellationToken = default)
    {
        if (request is null)
            return BadRequest(new 
            { 
                type = "https://tools.ietf.org/html/rfc9457",
                title = "Invalid Request",
                status = StatusCodes.Status400BadRequest,
                success = false, 
                code = "INVALID_REQUEST", 
                message = "Thiếu vai trò mới.", 
                detail = "Thiếu vai trò mới.",
                instance = HttpContext.Request.Path.Value,
                traceId = HttpContext.TraceIdentifier,
                error = new { code = "INVALID_REQUEST", message = "Thiếu vai trò mới." } 
            });
        if (!AdminMutationVersionPolicy.TryDecodeRequiredVersion(request.ExpectedVersion, out var expectedVersion))
            return BadRequest(new 
            { 
                type = "https://tools.ietf.org/html/rfc9457",
                title = "Invalid Version",
                status = StatusCodes.Status400BadRequest,
                success = false, 
                code = "INVALID_VERSION", 
                message = "Phiên bản dữ liệu người dùng không hợp lệ.", 
                detail = "Phiên bản dữ liệu người dùng không hợp lệ.",
                instance = HttpContext.Request.Path.Value,
                traceId = HttpContext.TraceIdentifier,
                error = new { code = "INVALID_VERSION", message = "Phiên bản dữ liệu người dùng không hợp lệ." } 
            });
        var currentAdminIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(currentAdminIdStr) || !Guid.TryParse(currentAdminIdStr, out var currentAdminId) || currentAdminId == Guid.Empty)
            return UnauthorizedEnvelope("Không xác định được danh tính quản trị viên từ token.");
        var adminEmail = User.FindFirstValue(ClaimTypes.Email) ?? "admin@tickex.com";
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();

        var result = await _adminUserOperations.ChangeRoleAsync(new ChangeUserRoleCommand(
            id, 
            request.Role, 
            currentAdminId,
            adminEmail,
            ipAddress,
            expectedVersion
        ), cancellationToken);

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

    public record BlockUserRequest(bool IsBlocked, string? ExpectedVersion = null);

    [HttpPut("users/{id}/block")]
    [Idempotent]
    public async Task<IActionResult> BlockUser(Guid id, [FromBody] BlockUserRequest? request, CancellationToken cancellationToken = default)
    {
        if (request is null)
            return BadRequest(new 
            { 
                type = "https://tools.ietf.org/html/rfc9457",
                title = "Invalid Request",
                status = StatusCodes.Status400BadRequest,
                success = false, 
                code = "INVALID_REQUEST", 
                message = "Thiếu trạng thái tài khoản.", 
                detail = "Thiếu trạng thái tài khoản.",
                instance = HttpContext.Request.Path.Value,
                traceId = HttpContext.TraceIdentifier,
                error = new { code = "INVALID_REQUEST", message = "Thiếu trạng thái tài khoản." } 
            });
        if (!AdminMutationVersionPolicy.TryDecodeRequiredVersion(request.ExpectedVersion, out var expectedVersion))
            return BadRequest(new 
            { 
                type = "https://tools.ietf.org/html/rfc9457",
                title = "Invalid Version",
                status = StatusCodes.Status400BadRequest,
                success = false, 
                code = "INVALID_VERSION", 
                message = "Phiên bản dữ liệu người dùng không hợp lệ.", 
                detail = "Phiên bản dữ liệu người dùng không hợp lệ.",
                instance = HttpContext.Request.Path.Value,
                traceId = HttpContext.TraceIdentifier,
                error = new { code = "INVALID_VERSION", message = "Phiên bản dữ liệu người dùng không hợp lệ." } 
            });
        var currentAdminIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(currentAdminIdStr) || !Guid.TryParse(currentAdminIdStr, out var currentAdminId) || currentAdminId == Guid.Empty)
            return UnauthorizedEnvelope("Không xác định được danh tính quản trị viên từ token.");
        var adminEmail = User.FindFirstValue(ClaimTypes.Email) ?? "admin@tickex.com";
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();

        var result = await _adminUserOperations.SetBlockedAsync(new BlockUserCommand(
            id, 
            request.IsBlocked, 
            currentAdminId,
            adminEmail,
            ipAddress,
            expectedVersion
        ), cancellationToken);

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

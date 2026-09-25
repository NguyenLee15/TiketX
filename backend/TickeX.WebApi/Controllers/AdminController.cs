using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TickeX.Application.Admin;
using TickeX.Application.Admin.Commands;
using TickeX.Application.Admin.Queries;
using TickeX.Application.Interfaces;
using Microsoft.AspNetCore.RateLimiting;

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
        if (page < 1 || pageSize is < 1 or > 100 || ((long)page - 1) * pageSize > int.MaxValue)
            return BadRequest(new { success = false, code = "PAGINATION_OUT_OF_RANGE", message = "page/pageSize nằm ngoài giới hạn hỗ trợ." });
        var result = await _mediator.Send(new GetRefundRequestsQuery(page, pageSize), cancellationToken);
        return Ok(new { success = true, data = result });
    }

    [HttpPost("refunds/{id:guid}/retries")]
    public async Task<IActionResult> RetryRefund(Guid id, CancellationToken cancellationToken = default)
    {
        var result = await _mediator.Send(new RetryRefundRequestCommand(id), cancellationToken);
        return result switch
        {
            "REFUND_NOT_FOUND" => NotFound(new { success = false, code = result, message = "Không tìm thấy yêu cầu hoàn tiền." }),
            "REFUND_RETRY_QUEUED" => Accepted(new { success = true, code = result }),
            "REFUND_COMPLETED" => Ok(new { success = true, code = result }),
            _ => Conflict(new { success = false, code = result, message = "Chưa thể retry cho đến khi trạng thái PayOS được đối soát." })
        };
    }

    public record ChangeRoleRequest(string Role, string? ExpectedVersion = null);

    [HttpPut("users/{id}/role")]
    public async Task<IActionResult> ChangeUserRole(Guid id, [FromBody] ChangeRoleRequest? request, CancellationToken cancellationToken = default)
    {
        if (request is null)
            return BadRequest(new { success = false, code = "INVALID_REQUEST", message = "Thiếu vai trò mới.", error = new { code = "INVALID_REQUEST", message = "Thiếu vai trò mới." } });
        if (!AdminMutationVersionPolicy.TryDecodeRequiredVersion(request.ExpectedVersion, out var expectedVersion))
            return BadRequest(new { success = false, code = "INVALID_VERSION", message = "Phiên bản dữ liệu người dùng không hợp lệ.", error = new { code = "INVALID_VERSION", message = "Phiên bản dữ liệu người dùng không hợp lệ." } });
        var currentAdminIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        Guid.TryParse(currentAdminIdStr, out var currentAdminId);
        var adminEmail = User.FindFirstValue(ClaimTypes.Email) ?? "admin@tickex.com";
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();

        var result = await _adminUserOperations.ChangeRoleAsync(new ChangeUserRoleCommand(
            id, 
            request.Role, 
            currentAdminId == Guid.Empty ? null : currentAdminId,
            adminEmail,
            ipAddress,
            expectedVersion
        ), cancellationToken);

        if (!result.Success)
            return StatusCode(result.StatusCode, new { success = false, code = result.ErrorCode, message = result.Message, error = new { code = result.ErrorCode, message = result.Message } });

        return Ok(new { success = true, code = "OK", message = result.Message, data = (object?)null });
    }

    public record BlockUserRequest(bool IsBlocked, string? ExpectedVersion = null);

    [HttpPut("users/{id}/block")]
    public async Task<IActionResult> BlockUser(Guid id, [FromBody] BlockUserRequest? request, CancellationToken cancellationToken = default)
    {
        if (request is null)
            return BadRequest(new { success = false, code = "INVALID_REQUEST", message = "Thiếu trạng thái tài khoản.", error = new { code = "INVALID_REQUEST", message = "Thiếu trạng thái tài khoản." } });
        if (!AdminMutationVersionPolicy.TryDecodeRequiredVersion(request.ExpectedVersion, out var expectedVersion))
            return BadRequest(new { success = false, code = "INVALID_VERSION", message = "Phiên bản dữ liệu người dùng không hợp lệ.", error = new { code = "INVALID_VERSION", message = "Phiên bản dữ liệu người dùng không hợp lệ." } });
        var currentAdminIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        Guid.TryParse(currentAdminIdStr, out var currentAdminId);
        var adminEmail = User.FindFirstValue(ClaimTypes.Email) ?? "admin@tickex.com";
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();

        var result = await _adminUserOperations.SetBlockedAsync(new BlockUserCommand(
            id, 
            request.IsBlocked, 
            currentAdminId == Guid.Empty ? null : currentAdminId,
            adminEmail,
            ipAddress,
            expectedVersion
        ), cancellationToken);

        if (!result.Success)
            return StatusCode(result.StatusCode, new { success = false, code = result.ErrorCode, message = result.Message, error = new { code = result.ErrorCode, message = result.Message } });

        return Ok(new { success = true, code = "OK", message = result.Message, data = (object?)null });
    }

}

using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using TickeX.Application.Users.Commands;
using TickeX.Application.Users.Queries;
using TickeX.WebApi.Filters;

namespace TickeX.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
[EnableRateLimiting("BookingPolicy")]
public class UsersController : ControllerBase
{
    private readonly IMediator _mediator;

    public UsersController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetProfile(CancellationToken cancellationToken = default)
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId))
            return UnauthorizedEnvelope();

        var result = await _mediator.Send(new GetUserProfileQuery(userId), cancellationToken);

        if (result == null) 
            return NotFound(new
            {
                type = "https://tools.ietf.org/html/rfc9110#section-15.5.5",
                title = "Not Found",
                status = StatusCodes.Status404NotFound,
                detail = "User not found",
                instance = HttpContext.Request.Path.Value,
                traceId = HttpContext.TraceIdentifier,
                success = false,
                code = "USER_NOT_FOUND",
                message = "User not found",
                error = new { code = "USER_NOT_FOUND", message = "User not found" }
            });

        return Ok(new { success = true, data = result });
    }

    [HttpPut("profile")]
    [Idempotent]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request, CancellationToken cancellationToken = default)
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId))
            return UnauthorizedEnvelope();

        var command = new UpdateProfileCommand(userId, request.Name, request.Phone, request.AvatarUrl);
        var success = await _mediator.Send(command, cancellationToken);

        if (!success) 
            return NotFound(new
            {
                type = "https://tools.ietf.org/html/rfc9110#section-15.5.5",
                title = "Not Found",
                status = StatusCodes.Status404NotFound,
                detail = "User not found",
                instance = HttpContext.Request.Path.Value,
                traceId = HttpContext.TraceIdentifier,
                success = false,
                code = "USER_NOT_FOUND",
                message = "User not found",
                error = new { code = "USER_NOT_FOUND", message = "User not found" }
            });

        return Ok(new { success = true, message = "Profile updated successfully" });
    }

    [HttpPost("change-password")]
    [Idempotent]
    [EnableRateLimiting("AuthPolicy")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request, CancellationToken cancellationToken = default)
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId))
            return UnauthorizedEnvelope();

        var command = new ChangePasswordCommand(userId, request.CurrentPassword, request.NewPassword);
        var success = await _mediator.Send(command, cancellationToken);

        if (!success) 
            return BadRequest(new
            {
                type = "https://tools.ietf.org/html/rfc9110#section-15.5.1",
                title = "Bad Request",
                status = StatusCodes.Status400BadRequest,
                detail = "Invalid current password or user not found",
                instance = HttpContext.Request.Path.Value,
                traceId = HttpContext.TraceIdentifier,
                success = false,
                code = "PASSWORD_CHANGE_FAILED",
                message = "Invalid current password or user not found",
                error = new { code = "PASSWORD_CHANGE_FAILED", message = "Invalid current password or user not found" }
            });

        return Ok(new { success = true, message = "Password changed successfully" });
    }

    [HttpPut("me/refund-bank-account")]
    [Idempotent]
    [EnableRateLimiting("AuthPolicy")]
    public async Task<IActionResult> SaveRefundBankAccount([FromBody] SaveRefundBankAccountRequest request, CancellationToken cancellationToken = default)
    {
        var userId = GetAuthenticatedUserId();
        if (userId is null) return UnauthorizedEnvelope();
        var saved = await _mediator.Send(new SaveRefundBankAccountCommand(userId.Value, request.BankBin, request.AccountName, request.AccountNumber), cancellationToken);
        if (!saved) return BadRequest(new
        {
            type = "https://tools.ietf.org/html/rfc9110#section-15.5.1",
            title = "Bad Request",
            status = StatusCodes.Status400BadRequest,
            detail = "Thông tin tài khoản nhận tiền không hợp lệ.",
            instance = HttpContext.Request.Path.Value,
            traceId = HttpContext.TraceIdentifier,
            success = false,
            code = "REFUND_BANK_ACCOUNT_INVALID",
            message = "Thông tin tài khoản nhận tiền không hợp lệ.",
            error = new { code = "REFUND_BANK_ACCOUNT_INVALID", message = "Thông tin tài khoản nhận tiền không hợp lệ." }
        });
        return NoContent();
    }

    [HttpDelete("me/refund-bank-account")]
    [Idempotent]
    public async Task<IActionResult> DeleteRefundBankAccount(CancellationToken cancellationToken = default)
    {
        var userId = GetAuthenticatedUserId();
        if (userId is null) return UnauthorizedEnvelope();
        await _mediator.Send(new DeleteRefundBankAccountCommand(userId.Value), cancellationToken);
        return NoContent();
    }

    private Guid? GetAuthenticatedUserId() =>
        Guid.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var userId) ? userId : null;

    private IActionResult UnauthorizedEnvelope() => Unauthorized(new
    {
        type = "https://tools.ietf.org/html/rfc9110#section-15.5.2",
        title = "Unauthorized",
        status = StatusCodes.Status401Unauthorized,
        detail = "User is not authenticated.",
        instance = HttpContext.Request.Path.Value,
        traceId = HttpContext.TraceIdentifier,
        success = false,
        code = "UNAUTHORIZED",
        message = "User is not authenticated.",
        error = new { code = "UNAUTHORIZED", message = "User is not authenticated." }
    });
}

public record UpdateProfileRequest(string Name, string Phone, string AvatarUrl);
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
public record SaveRefundBankAccountRequest(string BankBin, string AccountName, string AccountNumber);

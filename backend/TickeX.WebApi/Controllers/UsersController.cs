using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TickeX.Application.Users.Commands;
using TickeX.Application.Users.Queries;

namespace TickeX.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
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
            return NotFound(new { success = false, code = "USER_NOT_FOUND", message = "User not found", error = new { code = "USER_NOT_FOUND", message = "User not found" } });

        return Ok(new { success = true, data = result });
    }

    [HttpPut("profile")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request, CancellationToken cancellationToken = default)
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId))
            return UnauthorizedEnvelope();

        var command = new UpdateProfileCommand(userId, request.Name, request.Phone, request.AvatarUrl);
        var success = await _mediator.Send(command, cancellationToken);

        if (!success) 
            return NotFound(new { success = false, code = "USER_NOT_FOUND", message = "User not found", error = new { code = "USER_NOT_FOUND", message = "User not found" } });

        return Ok(new { success = true, message = "Profile updated successfully" });
    }

    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request, CancellationToken cancellationToken = default)
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId))
            return UnauthorizedEnvelope();

        var command = new ChangePasswordCommand(userId, request.CurrentPassword, request.NewPassword);
        var success = await _mediator.Send(command, cancellationToken);

        if (!success) 
            return BadRequest(new { success = false, code = "PASSWORD_CHANGE_FAILED", message = "Invalid current password or user not found", error = new { code = "PASSWORD_CHANGE_FAILED", message = "Invalid current password or user not found" } });

        return Ok(new { success = true, message = "Password changed successfully" });
    }

    [HttpPut("me/refund-bank-account")]
    public async Task<IActionResult> SaveRefundBankAccount([FromBody] SaveRefundBankAccountRequest request, CancellationToken cancellationToken = default)
    {
        var userId = GetAuthenticatedUserId();
        if (userId is null) return UnauthorizedEnvelope();
        var saved = await _mediator.Send(new SaveRefundBankAccountCommand(userId.Value, request.BankBin, request.AccountName, request.AccountNumber), cancellationToken);
        if (!saved) return BadRequest(new { success = false, code = "REFUND_BANK_ACCOUNT_INVALID", message = "Thông tin tài khoản nhận tiền không hợp lệ." });
        return NoContent();
    }

    [HttpDelete("me/refund-bank-account")]
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
        success = false,
        code = "UNAUTHORIZED",
        message = "User is not authenticated.",
        error = new { code = "UNAUTHORIZED", message = "User is not authenticated." }
    });
}

public record UpdateProfileRequest(string Name, string Phone, string AvatarUrl);
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
public record SaveRefundBankAccountRequest(string BankBin, string AccountName, string AccountNumber);

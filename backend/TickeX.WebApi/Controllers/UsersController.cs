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
    public async Task<IActionResult> GetProfile()
    {
        var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var result = await _mediator.Send(new GetUserProfileQuery(userId));

        if (result == null) return NotFound(new { success = false, message = "User not found" });

        return Ok(new { success = true, data = result });
    }

    [HttpPut("profile")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request)
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId))
            return Unauthorized();

        var command = new UpdateProfileCommand(userId, request.Name, request.Phone, request.AvatarUrl);
        var success = await _mediator.Send(command);

        if (!success) return NotFound(new { success = false, message = "User not found" });

        return Ok(new { success = true });
    }

    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId))
            return Unauthorized();

        var command = new ChangePasswordCommand(userId, request.CurrentPassword, request.NewPassword);
        var success = await _mediator.Send(command);

        if (!success) return BadRequest(new { success = false, message = "Invalid current password or user not found" });

        return Ok(new { success = true });
    }
}

public record UpdateProfileRequest(string Name, string Phone, string AvatarUrl);
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);

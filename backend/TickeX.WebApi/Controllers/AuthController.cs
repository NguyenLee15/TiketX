using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using TickeX.Application.Auth.Commands;
using TickeX.Application.Auth;
using TickeX.Application.Interfaces;
using TickeX.Infrastructure.Services;

namespace TickeX.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[AllowAnonymous]
[EnableRateLimiting("AuthPolicy")]
public class AuthController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly CookieAuthenticationSettings _cookieSettings;
    private readonly IRefreshTokenStore _refreshTokens;

    public AuthController(IMediator mediator, IOptions<CookieAuthenticationSettings> cookieSettings, IRefreshTokenStore refreshTokens)
    {
        _mediator = mediator;
        _cookieSettings = cookieSettings.Value;
        _refreshTokens = refreshTokens;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterCommand command, CancellationToken cancellationToken = default)
    {
        var result = await _mediator.Send(command, cancellationToken);
        if (!result.Success)
        {
            return BadRequest(new 
            { 
                success = false, 
                code = "REGISTRATION_FAILED", 
                message = result.Message,
                error = new { code = "REGISTRATION_FAILED", message = result.Message }
            });
        }
        return SignIn(result);
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginCommand command, CancellationToken cancellationToken = default)
    {
        var result = await _mediator.Send(command, cancellationToken);
        if (!result.Success)
        {
            return Unauthorized(new 
            { 
                success = false, 
                code = "INVALID_CREDENTIALS", 
                message = result.Message,
                error = new { code = "INVALID_CREDENTIALS", message = result.Message }
            });
        }
        return SignIn(result);
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout(CancellationToken cancellationToken)
    {
        var refresh = Request.Cookies[_cookieSettings.RefreshCookieName];
        if (!string.IsNullOrWhiteSpace(refresh))
            await _refreshTokens.RevokeAsync(RefreshTokenCrypto.Hash(refresh), cancellationToken);
        Response.Cookies.Delete(_cookieSettings.AccessCookieName, CookieAuthenticationSupport.CreateAccessCookie(_cookieSettings));
        Response.Cookies.Delete(_cookieSettings.CsrfCookieName, CookieAuthenticationSupport.CreateCsrfCookie(_cookieSettings));
        Response.Cookies.Delete(_cookieSettings.RefreshCookieName, CookieAuthenticationSupport.CreateRefreshCookie(_cookieSettings));
        return Ok(new { success = true, message = "Đã đăng xuất." });
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh([FromBody] RefreshRequest? request, CancellationToken cancellationToken)
    {
        var raw = Request.Cookies[_cookieSettings.RefreshCookieName] ?? request?.Token;
        var result = await _mediator.Send(new RefreshTokenCommand(raw ?? string.Empty), cancellationToken);
        if (!result.Success) 
            return Unauthorized(new 
            { 
                success = false, 
                code = "REFRESH_TOKEN_INVALID", 
                message = result.Message,
                error = new { code = "REFRESH_TOKEN_INVALID", message = result.Message }
            });
        return SignIn(result);
    }

    private IActionResult SignIn(AuthResult result)
    {
        Response.Cookies.Append(_cookieSettings.AccessCookieName, result.Token, CookieAuthenticationSupport.CreateAccessCookie(_cookieSettings));
        Response.Cookies.Append(_cookieSettings.RefreshCookieName, result.RefreshToken!, CookieAuthenticationSupport.CreateRefreshCookie(_cookieSettings));
        Response.Cookies.Append(_cookieSettings.CsrfCookieName, Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32)), CookieAuthenticationSupport.CreateCsrfCookie(_cookieSettings));
        // Bearer clients can opt in while browser clients use the HttpOnly cookie.
        var legacyToken = Request.Headers["X-Auth-Transport"].ToString().Equals("bearer", StringComparison.OrdinalIgnoreCase)
            ? result.Token : null;
        return Ok(new
        {
            success = true,
            data = new { token = legacyToken, refreshToken = legacyToken is null ? null : result.RefreshToken, userId = result.UserId, name = result.Name, email = result.Email, role = result.Role },
            message = result.Message
        });
    }

    public sealed record RefreshRequest(string? Token);
}

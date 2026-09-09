using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TickeX.Application.Interfaces;
using TickeX.Application.Auth;

namespace TickeX.Application.Auth.Commands;

public class LoginCommandHandler : IRequestHandler<LoginCommand, AuthResult>
{
    private const string GenericErrorMessage = "Email hoặc mật khẩu không chính xác.";

    private readonly IApplicationDbContext _context;
    private readonly IJwtService _jwtService;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ILogger<LoginCommandHandler> _logger;
    private readonly IRefreshTokenStore _refreshTokens;

    public LoginCommandHandler(
        IApplicationDbContext context,
        IJwtService jwtService,
        IPasswordHasher passwordHasher,
        ILogger<LoginCommandHandler> logger,
        IRefreshTokenStore refreshTokens)
    {
        _context = context;
        _jwtService = jwtService;
        _passwordHasher = passwordHasher;
        _logger = logger;
        _refreshTokens = refreshTokens;
    }

    public async Task<AuthResult> Handle(LoginCommand request, CancellationToken cancellationToken)
    {
        var normalizedEmail = (request.Email ?? string.Empty).Trim().ToLowerInvariant();

        // Query with tracking to allow updating AccessFailedCount and LockoutEnd atomically
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail, cancellationToken);
        
        if (user == null)
        {
            _passwordHasher.VerifyDummy(request.Password);
            _logger.LogWarning("Login failed: User with email {Email} not found.", normalizedEmail);
            return new AuthResult(false, string.Empty, GenericErrorMessage);
        }

        if (user.IsLockedOut())
        {
            _passwordHasher.VerifyDummy(request.Password);
            _logger.LogWarning("Login failed: User {Email} is locked out until {LockoutEnd}.", normalizedEmail, user.LockoutEnd);
            return new AuthResult(false, string.Empty, GenericErrorMessage);
        }

        if (user.IsBlocked)
        {
            _passwordHasher.VerifyDummy(request.Password);
            _logger.LogWarning("Login failed: User {Email} is blocked.", normalizedEmail);
            return new AuthResult(false, string.Empty, GenericErrorMessage);
        }

        if (!_passwordHasher.Verify(request.Password, user.PasswordHash))
        {
            user.RecordFailedLogin(maxFailedAccessAttempts: 5, lockoutMinutes: 15);
            await _context.SaveChangesAsync(cancellationToken);
            _logger.LogWarning("Login failed: Invalid password for user {Email}. Failed count: {Count}.", normalizedEmail, user.AccessFailedCount);
            return new AuthResult(false, string.Empty, GenericErrorMessage);
        }

        // Reset failed login counter on successful authentication
        user.ResetFailedLogin();
        await _context.SaveChangesAsync(cancellationToken);

        string token = _jwtService.GenerateToken(user);
        var refreshToken = RefreshTokenCrypto.Generate();
        await _refreshTokens.AddAsync(new TickeX.Domain.Entities.RefreshToken(
            user.Id, RefreshTokenCrypto.Hash(refreshToken), DateTime.UtcNow.AddDays(30)), cancellationToken);
        _logger.LogInformation("User {Email} ({UserId}) logged in successfully.", user.Email, user.Id);
        
        return new AuthResult(true, token, "Đăng nhập thành công.", user.Id, user.Name, user.Role, refreshToken);
    }
}

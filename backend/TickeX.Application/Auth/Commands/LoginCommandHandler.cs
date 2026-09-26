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
            _logger.LogWarning("Login failed: Account not found.");
            return new AuthResult(false, string.Empty, GenericErrorMessage);
        }

        if (user.IsLockedOut())
        {
            _passwordHasher.VerifyDummy(request.Password);
            _logger.LogWarning("Login failed: User {UserId} is locked out until {LockoutEnd}.", user.Id, user.LockoutEnd);
            return new AuthResult(false, string.Empty, GenericErrorMessage);
        }

        if (user.IsBlocked)
        {
            _passwordHasher.VerifyDummy(request.Password);
            _logger.LogWarning("Login failed: User {UserId} is blocked.", user.Id);
            return new AuthResult(false, string.Empty, GenericErrorMessage);
        }

        if (!_passwordHasher.Verify(request.Password, user.PasswordHash))
        {
            for (var concurrencyAttempt = 0; ; concurrencyAttempt++)
            {
                user.RecordFailedLogin(maxFailedAccessAttempts: 5, lockoutMinutes: 15);
                try
                {
                    await _context.SaveChangesAsync(cancellationToken);
                    break;
                }
                catch (DbUpdateConcurrencyException)
                {
                    if (_context is not DbContext dbContext || concurrencyAttempt >= 15)
                        throw;

                    var entry = dbContext.Entry(user);
                    await entry.ReloadAsync(cancellationToken);
                    if (entry.State == EntityState.Detached || user.IsBlocked || user.IsLockedOut())
                        return new AuthResult(false, string.Empty, GenericErrorMessage);
                }
            }

            _logger.LogWarning("Login failed: Invalid password for user {UserId}. Failed count: {Count}.", user.Id, user.AccessFailedCount);
            return new AuthResult(false, string.Empty, GenericErrorMessage);
        }

        // Reset failed login counter and persist new session atomically
        user.ResetFailedLogin();
        var refreshToken = RefreshTokenCrypto.Generate();
        var refreshTokenEntity = new TickeX.Domain.Entities.RefreshToken(
            user.Id, RefreshTokenCrypto.Hash(refreshToken), DateTime.UtcNow.AddDays(30));

        _context.RefreshTokens.Add(refreshTokenEntity);
        await _context.SaveChangesAsync(cancellationToken);

        string token = _jwtService.GenerateToken(user);
        _logger.LogInformation("User {UserId} logged in successfully.", user.Id);
        
        return new AuthResult(true, token, "Đăng nhập thành công.", user.Id, user.Name, user.Role, refreshToken, user.Email);
    }
}

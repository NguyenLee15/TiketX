using MediatR;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Interfaces;
using TickeX.Application.Auth;
using TickeX.Domain.Entities;

namespace TickeX.Application.Auth.Commands;

public class RegisterCommandHandler : IRequestHandler<RegisterCommand, AuthResult>
{
    private readonly IApplicationDbContext _context;
    private readonly IJwtService _jwtService;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IRefreshTokenStore _refreshTokens;

    public RegisterCommandHandler(
        IApplicationDbContext context,
        IJwtService jwtService,
        IPasswordHasher passwordHasher,
        IRefreshTokenStore refreshTokens)
    {
        _context = context;
        _jwtService = jwtService;
        _passwordHasher = passwordHasher;
        _refreshTokens = refreshTokens;
    }

    public async Task<AuthResult> Handle(RegisterCommand request, CancellationToken cancellationToken)
    {
        var normalizedEmail = (request.Email ?? string.Empty).Trim().ToLowerInvariant();

        if (await _context.Users.AnyAsync(u => u.Email == normalizedEmail, cancellationToken))
        {
            return new AuthResult(false, string.Empty, "Email is already taken.");
        }

        string passwordHash = _passwordHasher.Hash(request.Password);
        
        var user = new User(request.Name?.Trim() ?? string.Empty, normalizedEmail, passwordHash);
        
        _context.Users.Add(user);
        await _context.SaveChangesAsync(cancellationToken);

        string token = _jwtService.GenerateToken(user);
        var refreshToken = RefreshTokenCrypto.Generate();
        await _refreshTokens.AddAsync(new TickeX.Domain.Entities.RefreshToken(
            user.Id, RefreshTokenCrypto.Hash(refreshToken), DateTime.UtcNow.AddDays(30)), cancellationToken);
        
        return new AuthResult(true, token, "Registered successfully.", user.Id, user.Name, user.Role, refreshToken, user.Email);
    }
}

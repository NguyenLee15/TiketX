using MediatR;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Interfaces;
using TickeX.Application.Auth;

namespace TickeX.Application.Auth.Commands;

public sealed class RefreshTokenCommandHandler : IRequestHandler<RefreshTokenCommand, AuthResult>
{
    private readonly IRefreshTokenStore _tokens;
    private readonly IApplicationDbContext _db;
    private readonly IJwtService _jwt;

    public RefreshTokenCommandHandler(IRefreshTokenStore tokens, IApplicationDbContext db, IJwtService jwt)
    { _tokens = tokens; _db = db; _jwt = jwt; }

    public async Task<AuthResult> Handle(RefreshTokenCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Token)) return Invalid();
        var hash = RefreshTokenCrypto.Hash(request.Token);
        var current = await _tokens.FindAsync(hash, cancellationToken);
        if (current is null) return Invalid();
        if (!current.IsActive(DateTime.UtcNow))
        {
            // Reuse of a rotated token invalidates every session for the account.
            await _tokens.RevokeAllForUserAsync(current.UserId, cancellationToken);
            return Invalid();
        }
        var user = await _db.Users.FirstOrDefaultAsync(x => x.Id == current.UserId, cancellationToken);
        if (user is null || user.IsBlocked || user.IsLockedOut()) return Invalid();

        var replacementRaw = RefreshTokenCrypto.Generate();
        var replacement = new TickeX.Domain.Entities.RefreshToken(
            user.Id, RefreshTokenCrypto.Hash(replacementRaw), DateTime.UtcNow.AddDays(30));
        await _tokens.RotateAsync(current, replacement, cancellationToken);
        return new AuthResult(true, _jwt.GenerateToken(user), "Đã làm mới phiên.", user.Id, user.Name, user.Role, replacementRaw);
    }

    private static AuthResult Invalid() => new(false, string.Empty, "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.");
}

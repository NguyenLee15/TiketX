using Microsoft.EntityFrameworkCore;
using TickeX.Application.Auth;
using TickeX.Application.Interfaces;
using TickeX.Domain.Entities;
using TickeX.Infrastructure.Persistence;

namespace TickeX.Infrastructure.Services;

public sealed class RefreshTokenStore : IRefreshTokenStore
{
    private readonly ApplicationDbContext _db;
    public RefreshTokenStore(ApplicationDbContext db) => _db = db;

    public Task<RefreshToken?> FindActiveAsync(string tokenHash, CancellationToken cancellationToken) =>
        _db.RefreshTokens.FirstOrDefaultAsync(x => x.TokenHash == tokenHash && x.RevokedAtUtc == null && x.ExpiresAtUtc > DateTime.UtcNow, cancellationToken);

    public Task<RefreshToken?> FindAsync(string tokenHash, CancellationToken cancellationToken) =>
        _db.RefreshTokens.FirstOrDefaultAsync(x => x.TokenHash == tokenHash, cancellationToken);

    public async Task AddAsync(RefreshToken token, CancellationToken cancellationToken)
    {
        _db.RefreshTokens.Add(token);
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task RotateAsync(RefreshToken current, RefreshToken replacement, CancellationToken cancellationToken)
    {
        current.Revoke(replacement.TokenHash);
        _db.RefreshTokens.Add(replacement);
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task RevokeAsync(string tokenHash, CancellationToken cancellationToken)
    {
        var token = await _db.RefreshTokens.FirstOrDefaultAsync(x => x.TokenHash == tokenHash && x.RevokedAtUtc == null, cancellationToken);
        if (token is null) return;
        token.Revoke();
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task RevokeAllForUserAsync(Guid userId, CancellationToken cancellationToken)
    {
        var tokens = await _db.RefreshTokens.Where(x => x.UserId == userId && x.RevokedAtUtc == null).ToListAsync(cancellationToken);
        foreach (var token in tokens) token.Revoke();
        if (tokens.Count > 0) await _db.SaveChangesAsync(cancellationToken);
    }

}

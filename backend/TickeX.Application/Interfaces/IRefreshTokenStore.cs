using TickeX.Domain.Entities;

namespace TickeX.Application.Interfaces;

public interface IRefreshTokenStore
{
    Task<RefreshToken?> FindActiveAsync(string tokenHash, CancellationToken cancellationToken);
    Task<RefreshToken?> FindAsync(string tokenHash, CancellationToken cancellationToken);
    Task AddAsync(RefreshToken token, CancellationToken cancellationToken);
    Task RotateAsync(RefreshToken current, RefreshToken replacement, CancellationToken cancellationToken);
    Task RevokeAsync(string tokenHash, CancellationToken cancellationToken);
    Task RevokeAllForUserAsync(Guid userId, CancellationToken cancellationToken);
}

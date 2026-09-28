namespace TickeX.Application.Interfaces;

public sealed record UserSecurityState(string SecurityStamp, bool IsBlocked);

public interface IUserSecurityStateCache
{
    Task<UserSecurityState?> GetAsync(Guid userId, CancellationToken cancellationToken);
    Task SetAsync(Guid userId, UserSecurityState state, CancellationToken cancellationToken);
}

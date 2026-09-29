using MediatR;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Interfaces;

namespace TickeX.Application.Users.Commands;

public record ChangePasswordCommand(Guid UserId, string CurrentPassword, string NewPassword) : IRequest<bool>;

public class ChangePasswordCommandHandler : IRequestHandler<ChangePasswordCommand, bool>
{
    private readonly IApplicationDbContext _context;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IRefreshTokenStore? _refreshTokens;
    private readonly IUserSecurityStateCache? _securityStateCache;

    public ChangePasswordCommandHandler(IApplicationDbContext context, IPasswordHasher passwordHasher, IRefreshTokenStore? refreshTokens = null, IUserSecurityStateCache? securityStateCache = null)
    {
        _context = context;
        _passwordHasher = passwordHasher;
        _refreshTokens = refreshTokens;
        _securityStateCache = securityStateCache;
    }

    public async Task<bool> Handle(ChangePasswordCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 8 || request.NewPassword.Length > 128
            || !request.NewPassword.Any(char.IsLetter) || !request.NewPassword.Any(char.IsDigit))
            return false;

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == request.UserId, cancellationToken);
        if (user == null) return false;

        if (!_passwordHasher.Verify(request.CurrentPassword, user.PasswordHash))
        {
            return false;
        }

        var strategy = _context.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await _context.BeginTransactionAsync(cancellationToken);
            user.ChangePassword(_passwordHasher.Hash(request.NewPassword));
            await _context.SaveChangesAsync(cancellationToken);
            if (_refreshTokens is not null)
                await _refreshTokens.RevokeAllForUserAsync(user.Id, cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        });
        if (_securityStateCache is not null)
            await _securityStateCache.SetAsync(user.Id, new UserSecurityState(user.SecurityStamp, user.IsBlocked), CancellationToken.None);

        return true;
    }
}

using MediatR;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Interfaces;

namespace TickeX.Application.Users.Commands;

public record ChangePasswordCommand(Guid UserId, string CurrentPassword, string NewPassword) : IRequest<bool>;

public class ChangePasswordCommandHandler : IRequestHandler<ChangePasswordCommand, bool>
{
    private readonly IApplicationDbContext _context;
    private readonly IPasswordHasher _passwordHasher;

    public ChangePasswordCommandHandler(IApplicationDbContext context, IPasswordHasher passwordHasher)
    {
        _context = context;
        _passwordHasher = passwordHasher;
    }

    public async Task<bool> Handle(ChangePasswordCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 6 || request.NewPassword.Length > 128)
            return false;

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == request.UserId, cancellationToken);
        if (user == null) return false;

        if (!_passwordHasher.Verify(request.CurrentPassword, user.PasswordHash))
        {
            return false;
        }

        user.ChangePassword(_passwordHasher.Hash(request.NewPassword));
        var activeRefreshTokens = await _context.RefreshTokens
            .Where(token => token.UserId == user.Id && token.RevokedAtUtc == null)
            .ToListAsync(cancellationToken);
        foreach (var token in activeRefreshTokens)
            token.Revoke();

        await _context.SaveChangesAsync(cancellationToken);

        return true;
    }
}

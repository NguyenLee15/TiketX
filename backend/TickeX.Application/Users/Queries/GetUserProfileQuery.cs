using MediatR;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Interfaces;

namespace TickeX.Application.Users.Queries;

public record UserProfileDto(Guid Id, string Name, string Email, string Phone, string AvatarUrl, string Role,
    bool HasRefundBankAccount, string? RefundBankBin, string? RefundBankAccountName, string? RefundBankAccountMasked);

public record GetUserProfileQuery(Guid UserId) : IRequest<UserProfileDto?>;

public class GetUserProfileQueryHandler : IRequestHandler<GetUserProfileQuery, UserProfileDto?>
{
    private readonly IApplicationDbContext _context;
    private readonly IRefundBankAccountProtector _protector;

    public GetUserProfileQueryHandler(IApplicationDbContext context, IRefundBankAccountProtector protector)
    {
        _context = context;
        _protector = protector;
    }

    public async Task<UserProfileDto?> Handle(GetUserProfileQuery request, CancellationToken cancellationToken)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == request.UserId, cancellationToken);
        
        if (user == null) return null;

        var bankAccount = await _context.RefundBankAccounts.AsNoTracking().SingleOrDefaultAsync(x => x.UserId == user.Id, cancellationToken);
        var details = bankAccount is null ? null : _protector.Unprotect(bankAccount.EncryptedPayload);
        return new UserProfileDto(user.Id, user.Name, user.Email, user.Phone, user.AvatarUrl, user.Role,
            bankAccount is not null, details?.BankBin, details?.AccountName,
            bankAccount is null ? null : $"•••• {bankAccount.AccountLastFour}");
    }
}

using MediatR;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Interfaces;
using TickeX.Domain.Entities;

namespace TickeX.Application.Users.Commands;

public sealed record SaveRefundBankAccountCommand(Guid UserId, string BankBin, string AccountName, string AccountNumber) : IRequest<bool>;

public sealed class SaveRefundBankAccountCommandHandler(
    IApplicationDbContext context,
    IRefundBankAccountProtector protector) : IRequestHandler<SaveRefundBankAccountCommand, bool>
{
    public async Task<bool> Handle(SaveRefundBankAccountCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.BankBin) || request.BankBin.Length is < 6 or > 11 || request.BankBin.Any(c => !char.IsAsciiDigit(c))
            || string.IsNullOrWhiteSpace(request.AccountName) || request.AccountName.Trim().Length is < 2 or > 120 || request.AccountName.Any(char.IsControl)
            || string.IsNullOrWhiteSpace(request.AccountNumber) || request.AccountNumber.Length is < 6 or > 30
            || request.AccountNumber.Any(c => !char.IsAsciiDigit(c))) return false;

        if (!await context.Users.AnyAsync(x => x.Id == request.UserId, cancellationToken)) return false;
        var details = new RefundBankAccountDetails(request.BankBin.Trim(), request.AccountName.Trim(), request.AccountNumber.Trim());
        var encrypted = protector.Protect(details);
        var account = await context.RefundBankAccounts.SingleOrDefaultAsync(x => x.UserId == request.UserId, cancellationToken);
        if (account is null) context.RefundBankAccounts.Add(new RefundBankAccount(request.UserId, encrypted, details.AccountNumber[^4..]));
        else account.Replace(encrypted, details.AccountNumber[^4..]);

        var waitingRefunds = await context.RefundRequests
            .Where(x => x.TicketId != Guid.Empty && x.EncryptedDestinationSnapshot == null && x.Status == "AwaitingDestination")
            .Join(context.Tickets.Where(x => x.UserId == request.UserId), r => r.TicketId, t => t.Id, (refund, _) => refund)
            .ToListAsync(cancellationToken);
        foreach (var refund in waitingRefunds) refund.SetDestinationSnapshot(encrypted);

        context.AuditLogs.Add(new AuditLog(request.UserId, string.Empty, "REFUND_BANK_ACCOUNT_UPDATED", nameof(RefundBankAccount), request.UserId.ToString(), "Configured", "Updated"));
        await context.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public sealed record DeleteRefundBankAccountCommand(Guid UserId) : IRequest<bool>;

public sealed class DeleteRefundBankAccountCommandHandler(IApplicationDbContext context) : IRequestHandler<DeleteRefundBankAccountCommand, bool>
{
    public async Task<bool> Handle(DeleteRefundBankAccountCommand request, CancellationToken cancellationToken)
    {
        var account = await context.RefundBankAccounts.SingleOrDefaultAsync(x => x.UserId == request.UserId, cancellationToken);
        if (account is null) return false;
        context.RefundBankAccounts.Remove(account);
        context.AuditLogs.Add(new AuditLog(request.UserId, string.Empty, "REFUND_BANK_ACCOUNT_DELETED", nameof(RefundBankAccount), request.UserId.ToString(), "Configured", "Deleted"));
        await context.SaveChangesAsync(cancellationToken);
        return true;
    }
}

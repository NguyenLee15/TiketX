using MediatR;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Interfaces;

namespace TickeX.Application.Admin.Commands;

public sealed record RetryRefundRequestCommand(Guid RefundRequestId) : IRequest<string>;

public sealed class RetryRefundRequestCommandHandler(IApplicationDbContext context, IPayOSPayoutService payOs, IRefundBankAccountProtector protector) : IRequestHandler<RetryRefundRequestCommand, string>
{
    public async Task<string> Handle(RetryRefundRequestCommand request, CancellationToken cancellationToken)
    {
        var refund = await context.RefundRequests.SingleOrDefaultAsync(x => x.Id == request.RefundRequestId, cancellationToken);
        if (refund is null) return "REFUND_NOT_FOUND";
        if (refund.Status != "NeedsReview") return "REFUND_NOT_RETRYABLE";

        var stableReference = $"refund-{refund.Id:N}-{refund.ProviderRetryGeneration}";
        var remote = (refund.ProviderStatus is "PROCESSING" or "PENDING") && refund.ProviderReference is not null
            ? await payOs.GetStatusAsync(refund.ProviderReference, cancellationToken)
            : await payOs.FindByReferenceAsync(stableReference, cancellationToken);
        if (remote.State == "SUCCEEDED")
        {
            if (refund.EncryptedDestinationSnapshot is null
                || !remote.MatchesDestination(protector.Unprotect(refund.EncryptedDestinationSnapshot)))
                return "REFUND_DESTINATION_REVIEW_REQUIRED";
            var ticket = await context.Tickets.SingleAsync(x => x.Id == refund.TicketId, cancellationToken);
            var payment = await context.PaymentTransactions.SingleOrDefaultAsync(x => x.TicketId == refund.TicketId, cancellationToken);
            if (ticket.Status == TickeX.Domain.Enums.TicketStatus.RefundPending) ticket.CompleteRefund(refund.Amount);
            else if (ticket.Status == TickeX.Domain.Enums.TicketStatus.Cancelled && ticket.RefundedAt is null && payment?.Status == "OrphanedPaid")
                ticket.CompleteOrphanCompensation(refund.Amount);
            else return "REFUND_TICKET_REVIEW_REQUIRED";
            payment?.MarkRefunded(remote.PayoutId ?? refund.ProviderReference ?? stableReference, "PayOS payout reconciled as SUCCEEDED");
            refund.MarkCompleted(remote.PayoutId ?? refund.ProviderReference ?? stableReference);
            await context.SaveChangesAsync(cancellationToken);
            return "REFUND_COMPLETED";
        }
        if (remote.Error is not null || remote.State is not ("FAILED" or "CANCELLED" or "REJECTED" or "ERROR"))
            return "REFUND_PROVIDER_NOT_RECONCILED";

        refund.RetryAfterReconciliation(DateTime.UtcNow, remote.State);
        await context.SaveChangesAsync(cancellationToken);
        return "REFUND_RETRY_QUEUED";
    }
}

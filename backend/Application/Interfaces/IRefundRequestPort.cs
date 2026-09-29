namespace TickeX.Application.Interfaces;

public enum RefundEnqueueResult { Created, AlreadyExists, ConcurrencyConflict }

public sealed record RefundEnqueueItem(Guid EventId, Guid TicketId, decimal Amount, string IdempotencyKey, string? EncryptedDestinationSnapshot = null);

public interface IRefundRequestPort
{
    /// <summary>
    /// Adds the refund outbox rows and commits them atomically with every
    /// ticket, payment, event and audit change already tracked in the caller's
    /// unit of work. The adapter owns provider-specific idempotency handling.
    /// </summary>
    Task<RefundEnqueueResult> EnqueueAsync(IReadOnlyCollection<RefundEnqueueItem> items, CancellationToken cancellationToken);
}

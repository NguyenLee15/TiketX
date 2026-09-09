namespace TickeX.Domain.Entities;

/// <summary>
/// Durable outbox item for an event-cancellation refund. The ticket remains
/// RefundPending until a provider webhook confirms completion.
/// </summary>
public class RefundRequest : BaseEntity
{
    public Guid EventId { get; private set; }
    public Guid TicketId { get; private set; }
    public decimal Amount { get; private set; }
    public string IdempotencyKey { get; private set; } = string.Empty;
    public string Status { get; private set; } = "Pending";
    public int AttemptCount { get; private set; }
    public DateTime? NextAttemptAt { get; private set; }
    public DateTime? ProcessedAt { get; private set; }
    public string? LastError { get; private set; }

    private RefundRequest() { }

    public RefundRequest(Guid eventId, Guid ticketId, decimal amount, string idempotencyKey)
    {
        EventId = eventId;
        TicketId = ticketId;
        Amount = amount;
        IdempotencyKey = idempotencyKey;
        Status = "Pending";
        AttemptCount = 0;
        NextAttemptAt = DateTime.UtcNow;
    }

    public void MarkProcessing()
    {
        Status = "Processing";
        AttemptCount++;
        NextAttemptAt = null;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkCompleted()
    {
        Status = "Completed";
        ProcessedAt = DateTime.UtcNow;
        NextAttemptAt = null;
        LastError = null;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkFailed(string error, TimeSpan retryAfter)
    {
        Status = "Failed";
        LastError = error;
        NextAttemptAt = DateTime.UtcNow.Add(retryAfter);
        UpdatedAt = DateTime.UtcNow;
    }
}

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
    public string? EncryptedDestinationSnapshot { get; private set; }
    public string? ProviderReference { get; private set; }
    public string? ProviderStatus { get; private set; }
    public int ProviderRetryGeneration { get; private set; }
    public string? LeaseOwner { get; private set; }
    public DateTime? LeaseUntil { get; private set; }

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

    public void SetDestinationSnapshot(string encryptedSnapshot)
    {
        if (string.IsNullOrWhiteSpace(encryptedSnapshot)) throw new ArgumentException("Encrypted destination is required.", nameof(encryptedSnapshot));
        EncryptedDestinationSnapshot = encryptedSnapshot;
        if (Status == "AwaitingDestination") Status = "Pending";
        NextAttemptAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void WaitForDestination()
    {
        if (Status == "Completed") return;
        Status = "AwaitingDestination";
        NextAttemptAt = null;
        UpdatedAt = DateTime.UtcNow;
    }

    public bool TryClaim(string owner, DateTime leaseUntil, DateTime now)
    {
        if (EncryptedDestinationSnapshot is null || Status is "Completed" or "NeedsReview" || NextAttemptAt > now || (LeaseUntil.HasValue && LeaseUntil > now)) return false;
        LeaseOwner = owner;
        LeaseUntil = leaseUntil;
        Status = "Processing";
        AttemptCount++;
        NextAttemptAt = null;
        UpdatedAt = now;
        return true;
    }

    public void SetProviderReference(string reference, string status)
    {
        ProviderReference = reference;
        ProviderStatus = status;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkCompleted(string reference)
    {
        ProviderReference = reference;
        ProviderStatus = "SUCCEEDED";
        Status = "Completed";
        ProcessedAt = DateTime.UtcNow;
        NextAttemptAt = null;
        LastError = null;
        LeaseOwner = null;
        LeaseUntil = null;
        UpdatedAt = DateTime.UtcNow;
    }

    public void ScheduleRetry(string error, DateTime nextAttemptAt, string? providerStatus)
    {
        Status = "Pending";
        LastError = error;
        ProviderStatus = providerStatus;
        NextAttemptAt = nextAttemptAt;
        LeaseOwner = null;
        LeaseUntil = null;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkNeedsReview(string error, string? providerStatus)
    {
        Status = "NeedsReview";
        LastError = error;
        ProviderStatus = providerStatus;
        NextAttemptAt = null;
        LeaseOwner = null;
        LeaseUntil = null;
        UpdatedAt = DateTime.UtcNow;
    }

    public void RetryAfterReconciliation(DateTime now, string reconciledProviderStatus)
    {
        if (Status != "NeedsReview" || reconciledProviderStatus is not ("FAILED" or "CANCELLED" or "REJECTED" or "ERROR"))
            throw new InvalidOperationException("Refund requires a reconciled terminal provider state before retry.");
        ProviderRetryGeneration++;
        ProviderReference = null;
        ProviderStatus = null;
        Status = EncryptedDestinationSnapshot is null ? "AwaitingDestination" : "Pending";
        LastError = null;
        NextAttemptAt = EncryptedDestinationSnapshot is null ? null : now;
        UpdatedAt = now;
    }
}

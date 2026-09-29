namespace TickeX.Domain.Entities;

public sealed class NotificationOutboxItem : BaseEntity
{
    public Guid TicketId { get; private set; }
    public Guid UserId { get; private set; }
    public Guid EventId { get; private set; }
    public string Status { get; private set; } = "Pending";
    public int AttemptCount { get; private set; }
    public DateTime? NextAttemptAt { get; private set; }
    public DateTime? ProcessedAt { get; private set; }
    public string? LastError { get; private set; }
    private NotificationOutboxItem() { }
    public NotificationOutboxItem(Guid ticketId, Guid userId, Guid eventId)
    {
        (TicketId, UserId, EventId) = (ticketId, userId, eventId);
        NextAttemptAt = DateTime.UtcNow;
    }
    public void MarkProcessing(TimeSpan leaseDuration, string? leaseToken = null)
    {
        Status = "Processing";
        NextAttemptAt = DateTime.UtcNow.Add(leaseDuration);
        if (leaseToken != null) LastError = leaseToken;
        UpdatedAt = DateTime.UtcNow;
    }
    public void MarkCompleted() { Status = "Completed"; ProcessedAt = DateTime.UtcNow; NextAttemptAt = null; LastError = null; UpdatedAt = DateTime.UtcNow; }
    public void MarkFailed(string error, TimeSpan retryAfter) { Status = "Pending"; AttemptCount++; LastError = error; NextAttemptAt = DateTime.UtcNow.Add(retryAfter); UpdatedAt = DateTime.UtcNow; }
}

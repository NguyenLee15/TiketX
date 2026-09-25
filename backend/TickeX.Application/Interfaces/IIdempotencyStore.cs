namespace TickeX.Application.Interfaces;

public sealed record IdempotencyClaim(bool Acquired, string? ExistingRecord, string OwnerToken);

public interface IIdempotencyStore
{
    Task<IdempotencyClaim> TryClaimAsync(string key, string processingRecord, TimeSpan ttl, CancellationToken cancellationToken);
    Task CompleteAsync(string key, string ownerToken, string completedRecord, TimeSpan ttl, CancellationToken cancellationToken);
    Task ReleaseAsync(string key, string ownerToken, CancellationToken cancellationToken);
}

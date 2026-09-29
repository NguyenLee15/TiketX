namespace TickeX.Application.Interfaces;

public interface ISeatHubAdmissionPolicy
{
    Task<bool> TryJoinAsync(string connectionId, string? clientIp, Guid eventId, CancellationToken cancellationToken = default);
    Task<bool> LeaveGroupAsync(string connectionId, Guid eventId, CancellationToken cancellationToken = default);
    Task ReleaseAsync(string connectionId, CancellationToken cancellationToken = default);
}

namespace TickeX.Application.Interfaces;

public interface ISeatNotificationService
{
    Task NotifySeatStatusChanged(
        Guid eventId,
        Guid seatId,
        string status,
        string? version = null,
        DateTime? expiresAt = null);
    Task NotifyOwnSeatLockChanged(
        Guid userId,
        Guid eventId,
        Guid seatId,
        string status,
        string version,
        DateTime expiresAt);
}

namespace TickeX.Application.Interfaces;

public interface ISeatNotificationService
{
    Task NotifySeatStatusChanged(
        Guid eventId,
        Guid seatId,
        string status,
        string? version = null,
        DateTime? expiresAt = null);
    Task NotifySeatStatusChanged(
        Guid eventId,
        Guid seatId,
        string status,
        string? version,
        DateTime? expiresAt,
        Guid? reservationOwnerId);
    Task NotifyOwnSeatLockChanged(
        Guid userId,
        Guid eventId,
        Guid seatId,
        string status,
        string version,
        DateTime expiresAt);
}

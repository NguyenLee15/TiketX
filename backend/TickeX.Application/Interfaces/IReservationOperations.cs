namespace TickeX.Application.Interfaces;

public sealed record ReservationResult(
    bool Success,
    string Code,
    string Message,
    Guid? TicketId = null,
    DateTime? ExpiresAt = null);

public interface IReservationOperations
{
    Task<ReservationResult> ReserveAsync(Guid eventId, Guid seatId, Guid userId, byte[] version, CancellationToken cancellationToken);
    Task<ReservationResult> ReleaseAsync(Guid ticketId, Guid userId, string reason, CancellationToken cancellationToken);
    Task<ReservationResult> ExpireAsync(Guid ticketId, CancellationToken cancellationToken);
}

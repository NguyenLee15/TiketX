using Microsoft.AspNetCore.SignalR;
using TickeX.Application.Interfaces;
using TickeX.Infrastructure.Hubs;

namespace TickeX.Infrastructure.Services;

public class SeatNotificationService : ISeatNotificationService
{
    private readonly IHubContext<SeatHub> _hubContext;

    public SeatNotificationService(IHubContext<SeatHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public async Task NotifySeatStatusChanged(Guid eventId, Guid seatId, string status, string? version = null, DateTime? expiresAt = null)
    {
        await _hubContext.Clients.Group(eventId.ToString()).SendAsync("SeatStatusChanged", new
        {
            EventId = eventId,
            SeatId = seatId,
            Status = status,
            Version = version,
            ExpiresAt = expiresAt
        });
    }

    public async Task NotifySeatStatusChanged(Guid eventId, Guid seatId, string status, string? version, DateTime? expiresAt, Guid? reservationOwnerId)
    {
        await _hubContext.Clients.Group(eventId.ToString()).SendAsync("SeatStatusChanged", new
        {
            EventId = eventId,
            SeatId = seatId,
            Status = status,
            Version = version,
            ExpiresAt = expiresAt,
            ReservationOwnerId = reservationOwnerId
        });
    }

    public Task NotifyOwnSeatLockChanged(Guid userId, Guid eventId, Guid seatId, string status, string version, DateTime expiresAt) =>
        _hubContext.Clients.User(userId.ToString()).SendAsync("OwnSeatLockChanged", new
        {
            EventId = eventId,
            SeatId = seatId,
            Status = status,
            Version = version,
            ExpiresAt = expiresAt,
            IsLockedByCurrentUser = true
        });
}

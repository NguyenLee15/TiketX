using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using TickeX.Application.Interfaces;
using TickeX.Application.Seats;
using TickeX.Domain.Entities;
using TickeX.Domain.Enums;

namespace TickeX.Infrastructure.Services;

public sealed class ReservationOperations : IReservationOperations
{
    private readonly IApplicationDbContext _context;
    private readonly IDistributedLockService _locks;
    private readonly ISeatNotificationService _notifications;
    private readonly IReservationExpiryScheduler _scheduler;
    private readonly ReservationOptions _options;
    private readonly ILogger<ReservationOperations> _logger;
    private readonly ITimePolicy _time;

    public ReservationOperations(
        IApplicationDbContext context,
        IDistributedLockService locks,
        ISeatNotificationService notifications,
        IReservationExpiryScheduler scheduler,
        IOptions<ReservationOptions> options,
        ILogger<ReservationOperations> logger,
        ITimePolicy? time = null)
    {
        _context = context;
        _locks = locks;
        _notifications = notifications;
        _scheduler = scheduler;
        _options = options.Value;
        _logger = logger;
        _time = time ?? new UtcTimePolicy();
    }

    public async Task<ReservationResult> ReserveAsync(Guid eventId, Guid seatId, Guid userId, byte[] version, CancellationToken cancellationToken)
    {
        var limitKey = $"seat-limit:{userId}:{eventId}";
        if (!await TryAcquireAsync(limitKey, TimeSpan.FromSeconds(30), cancellationToken))
            return Fail("RESERVATION_LOCK_UNAVAILABLE", "Không thể khóa thao tác đặt vé lúc này. Vui lòng thử lại.");

        try
        {
            var pendingCount = await _context.Tickets.CountAsync(
                t => t.UserId == userId && t.EventId == eventId && t.Status == TicketStatus.Pending,
                cancellationToken);
            if (pendingCount >= _options.MaximumPendingSeatsPerEvent)
                return Fail("RESERVATION_LIMIT_REACHED", $"Mỗi khách chỉ được giữ tối đa {_options.MaximumPendingSeatsPerEvent} ghế cho một sự kiện.");

            var seatKey = $"seat:lock:{seatId}";
            if (!await TryAcquireAsync(seatKey, TimeSpan.FromMinutes(_options.HoldMinutes), cancellationToken))
                return Fail("RESERVATION_LOCK_UNAVAILABLE", "Ghế đang được xử lý hoặc dịch vụ khóa tạm thời chưa sẵn sàng.");

            try
            {
                var seat = await _context.Seats.Include(s => s.Event)
                    .FirstOrDefaultAsync(s => s.Id == seatId && s.EventId == eventId, cancellationToken);
                if (seat?.Event == null || seat.Event.IsDeleted || seat.Event.Status != EventStatus.Published || seat.Event.Date <= _time.UtcNow)
                    return Fail("EVENT_NOT_ON_SALE", "Sự kiện không còn mở bán.");

                if (version.Length == 0 || !seat.Version.SequenceEqual(version))
                    return Fail("SEAT_VERSION_CONFLICT", "Trạng thái ghế đã thay đổi. Vui lòng chọn lại.");

                var holdDuration = TimeSpan.FromMinutes(_options.HoldMinutes);
                var expired = seat.IsLockExpired(holdDuration);
                if (seat.Status != SeatStatus.Available && !expired)
                    return Fail("SEAT_UNAVAILABLE", "Ghế đã được giữ hoặc bán.");

                if (expired)
                {
                    var oldTickets = await _context.Tickets
                        .Where(t => t.SeatId == seat.Id && t.Status == TicketStatus.Pending)
                        .ToListAsync(cancellationToken);
                    foreach (var oldTicket in oldTickets) oldTicket.Cancel();
                    seat.ReclaimLock(userId);
                }
                else
                {
                    seat.Lock(userId);
                }

                var ticket = new Ticket(eventId, seatId, userId, seat.Price);
                _context.Tickets.Add(ticket);
                await _context.SaveChangesAsync(cancellationToken);
                var expiresAt = _time.UtcNow.Add(holdDuration);
                try { _scheduler.Schedule(ticket.Id, holdDuration); }
                catch (Exception ex) { _logger.LogError(ex, "Reservation {TicketId} committed but expiry scheduling failed; stale-lock reconciliation remains active", ticket.Id); }
                try
                {
                    var versionToken = Convert.ToBase64String(seat.Version);
                    await _notifications.NotifySeatStatusChanged(eventId, seatId, seat.Status.ToString(), versionToken, expiresAt);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Reservation {TicketId} committed but public realtime notification failed", ticket.Id);
                }
                try
                {
                    await _notifications.NotifyOwnSeatLockChanged(
                        userId, eventId, seatId, seat.Status.ToString(), Convert.ToBase64String(seat.Version), expiresAt);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Reservation {TicketId} committed but private realtime notification failed", ticket.Id);
                }
                return new ReservationResult(true, "RESERVATION_CREATED", "Giữ ghế thành công.", ticket.Id, expiresAt);
            }
            catch (DbUpdateConcurrencyException)
            {
                return Fail("SEAT_VERSION_CONFLICT", "Trạng thái ghế đã thay đổi. Vui lòng chọn lại.");
            }
            finally
            {
                await SafeReleaseAsync(seatKey);
            }
        }
        finally
        {
            await SafeReleaseAsync(limitKey);
        }
    }

    public async Task<ReservationResult> ReleaseAsync(Guid ticketId, Guid userId, string reason, CancellationToken cancellationToken)
        => await ReleaseCoreAsync(ticketId, userId, requireOwner: true, reason, cancellationToken);

    public async Task<ReservationResult> ExpireAsync(Guid ticketId, CancellationToken cancellationToken)
        => await ReleaseCoreAsync(ticketId, Guid.Empty, requireOwner: false, "reservation_expired", cancellationToken);

    private async Task<ReservationResult> ReleaseCoreAsync(Guid ticketId, Guid userId, bool requireOwner, string reason, CancellationToken cancellationToken)
    {
        var ticket = await _context.Tickets.Include(t => t.Seat)
            .FirstOrDefaultAsync(t => t.Id == ticketId, cancellationToken);
        if (ticket == null)
            return Fail("RESERVATION_NOT_FOUND", "Không tìm thấy lượt giữ ghế.");
        if (requireOwner && ticket.UserId != userId)
            return Fail("RESERVATION_FORBIDDEN", "Bạn không có quyền hủy lượt giữ ghế này.");
        if (ticket.Status != TicketStatus.Pending)
            return Fail("RESERVATION_NOT_PENDING", "Lượt giữ ghế không còn ở trạng thái chờ.");

        var lockKey = $"seat:lock:{ticket.SeatId}";
        if (!await TryAcquireAsync(lockKey, TimeSpan.FromSeconds(30), cancellationToken))
            return Fail("RESERVATION_LOCK_UNAVAILABLE", "Không thể khóa thao tác hủy giữ ghế lúc này.");
        try
        {
            var current = await _context.Tickets.Include(t => t.Seat)
                .FirstOrDefaultAsync(t => t.Id == ticketId, cancellationToken);
            if (current == null || (requireOwner && current.UserId != userId) || current.Status != TicketStatus.Pending)
                return Fail("RESERVATION_NOT_PENDING", "Lượt giữ ghế đã thay đổi.");
            if (current.Seat?.Status == SeatStatus.Locked && (!requireOwner || current.Seat.LockedByUserId == userId))
                current.Seat.Release();
            _context.AuditLogs.Add(new AuditLog(
                userId: requireOwner ? userId : null,
                userEmail: string.Empty,
                action: "RESERVATION_RELEASED",
                entityName: "Ticket",
                entityId: current.Id.ToString(),
                beforeState: $"Status={TicketStatus.Pending},SeatStatus={current.Seat?.Status}",
                afterState: $"Status={TicketStatus.Cancelled},Reason={reason}"));
            current.Cancel();
            await _context.SaveChangesAsync(cancellationToken);
            if (current.Seat != null)
                try
                {
                    await _notifications.NotifySeatStatusChanged(
                        current.EventId, current.SeatId, current.Seat.Status.ToString(), Convert.ToBase64String(current.Seat.Version));
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Reservation {TicketId} was released but realtime notification failed", current.Id);
                }
            return new ReservationResult(true, "RESERVATION_RELEASED", "Đã hủy lượt giữ ghế.");
        }
        finally
        {
            await SafeReleaseAsync(lockKey);
        }
    }

    private async Task<bool> TryAcquireAsync(string key, TimeSpan duration, CancellationToken cancellationToken)
    {
        try { return await _locks.AcquireLockAsync(key, duration, cancellationToken); }
        catch (Exception ex) { _logger.LogWarning(ex, "Required reservation lock {LockKey} is unavailable", key); return false; }
    }

    private async Task SafeReleaseAsync(string key)
    {
        try { await _locks.ReleaseLockAsync(key); }
        catch (Exception ex) { _logger.LogWarning(ex, "Could not release reservation lock {LockKey}", key); }
    }

    private static ReservationResult Fail(string code, string message) => new(false, code, message);
}

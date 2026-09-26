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
    private readonly IPayOSService? _payOS;

    public ReservationOperations(
        IApplicationDbContext context,
        IDistributedLockService locks,
        ISeatNotificationService notifications,
        IReservationExpiryScheduler scheduler,
        IOptions<ReservationOptions> options,
        ILogger<ReservationOperations> logger,
        ITimePolicy? time = null,
        IPayOSService? payOS = null)
    {
        _context = context;
        _locks = locks;
        _notifications = notifications;
        _scheduler = scheduler;
        _options = options.Value;
        _logger = logger;
        _time = time ?? new UtcTimePolicy();
        _payOS = payOS;
    }

    public async Task<ReservationResult> ReserveAsync(Guid eventId, Guid seatId, Guid userId, byte[] version, CancellationToken cancellationToken)
    {
        var limitKey = $"seat-limit:{userId}:{eventId}";
        var limitLease = await TryAcquireAsync(limitKey, TimeSpan.FromSeconds(30), cancellationToken);
        if (limitLease is null)
            return Fail("RESERVATION_LOCK_UNAVAILABLE", "Không thể khóa thao tác đặt vé lúc này. Vui lòng thử lại.");

        await using (limitLease)
        {
            var holdThreshold = _time.UtcNow.AddMinutes(-_options.HoldMinutes);
            var pendingCount = await _context.Tickets.CountAsync(
                t => t.UserId == userId && t.EventId == eventId && t.Status == TicketStatus.Pending && t.CreatedAt > holdThreshold,
                cancellationToken);
            if (pendingCount >= _options.MaximumPendingSeatsPerEvent)
                return Fail("RESERVATION_LIMIT_REACHED", $"Mỗi khách chỉ được giữ tối đa {_options.MaximumPendingSeatsPerEvent} ghế cho một sự kiện.");

            var seatKey = $"seat:lock:{seatId}";
            var seatLease = await TryAcquireAsync(seatKey, TimeSpan.FromMinutes(_options.HoldMinutes), cancellationToken);
            if (seatLease is null)
                return Fail("RESERVATION_LOCK_UNAVAILABLE", "Ghế đang được xử lý hoặc dịch vụ khóa tạm thời chưa sẵn sàng.");

            try
            {
            await using (seatLease)
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
                    var oldIds = oldTickets.Select(t => t.Id).ToArray();
                    if (await _context.PaymentTransactions.AnyAsync(p => oldIds.Contains(p.TicketId) && p.Status == "Pending", cancellationToken))
                        return Fail("SEAT_UNAVAILABLE", "Thanh toán cũ đang được đối soát; ghế chưa thể mở bán lại.");
                    foreach (var oldTicket in oldTickets) oldTicket.Cancel();
                    seat.ReclaimLock(userId);
                }
                else
                {
                    seat.Lock(userId);
                }

                var ticket = new Ticket(eventId, seatId, userId, seat.Price);
                _context.Tickets.Add(ticket);
                if (!limitLease.IsValid || !seatLease.IsValid)
                    return Fail("RESERVATION_LOCK_LOST", "Khóa đặt ghế đã hết hạn. Vui lòng thử lại.");
                for (var attempt = 0; ; attempt++)
                {
                    try
                    {
                        await _context.SaveChangesAsync(cancellationToken);
                        break;
                    }
                    catch (DbUpdateException ex) when (attempt < 2 && IsOrderCodeConflict(ex))
                    {
                        ticket.RegenerateOrderCode();
                    }
                }
                var expiresAt = _time.UtcNow.Add(holdDuration);
                try { _scheduler.Schedule(ticket.Id, holdDuration); }
                catch (Exception ex) { _logger.LogError(ex, "Reservation {TicketId} committed but expiry scheduling failed; stale-lock reconciliation remains active", ticket.Id); }
                try
                {
                    var versionToken = Convert.ToBase64String(seat.Version);
                    await _notifications.NotifySeatStatusChanged(eventId, seatId, seat.Status.ToString(), versionToken, expiresAt, userId);
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
            }
            catch (DbUpdateConcurrencyException)
            {
                return Fail("SEAT_VERSION_CONFLICT", "Trạng thái ghế đã thay đổi. Vui lòng chọn lại.");
            }
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

        var paymentLease = await TryAcquireAsync($"payment:lock:{ticket.OrderCode}", TimeSpan.FromSeconds(30), cancellationToken);
        if (paymentLease is null)
            return Fail("RESERVATION_LOCK_UNAVAILABLE", "Không thể khóa thao tác hủy giữ ghế lúc này.");
        await using (paymentLease)
        {
            var lease = await TryAcquireAsync($"seat:lock:{ticket.SeatId}", TimeSpan.FromSeconds(30), cancellationToken);
            if (lease is null) return Fail("RESERVATION_LOCK_UNAVAILABLE", "Không thể khóa thao tác hủy giữ ghế lúc này.");
            await using (lease)
            {
            var current = await _context.Tickets.Include(t => t.Seat)
                .FirstOrDefaultAsync(t => t.Id == ticketId, cancellationToken);
            if (current == null || (requireOwner && current.UserId != userId) || current.Status != TicketStatus.Pending)
                return Fail("RESERVATION_NOT_PENDING", "Lượt giữ ghế đã thay đổi.");
            var latest = await _context.Tickets.AsNoTracking().Include(t => t.Seat)
                .Where(t => t.Id == ticketId)
                .Select(t => new { t.Status, SeatStatus = t.Seat.Status, t.Seat.LockedByUserId })
                .SingleAsync(cancellationToken);
            if (latest.Status != TicketStatus.Pending || latest.SeatStatus != SeatStatus.Locked || latest.LockedByUserId != current.UserId)
                return Fail("RESERVATION_NOT_PENDING", "Lượt giữ ghế đã thay đổi.");
            var payment = await _context.PaymentTransactions.SingleOrDefaultAsync(p => p.OrderCode == current.OrderCode, cancellationToken);
            if (payment?.Status == "Pending")
            {
                if (payment.CheckoutUrl.StartsWith("/mock-payos", StringComparison.Ordinal))
                {
                    payment.MarkCancelled();
                }
                else
                {
                    PayOSPaymentLinkState? state = null;
                    try
                    {
                        if (_payOS is not null)
                        {
                            state = await _payOS.CancelPaymentLinkAsync(current.OrderCode, reason, cancellationToken);
                            if (state?.Status != "CANCELLED")
                                state = await _payOS.GetPaymentLinkStateAsync(current.OrderCode, cancellationToken);
                        }
                    }
                    catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
                    catch (Exception ex) { _logger.LogWarning(ex, "PayOS cancellation state unknown for {OrderCode}", current.OrderCode); }
                    if (state?.Status == "CANCELLED") payment.MarkCancelled();
                    else
                    {
                        _logger.LogWarning("Reservation {TicketId} retained for PayOS reconciliation; provider state {ProviderState}", current.Id, state?.Status ?? "UNKNOWN");
                        if (!requireOwner)
                        {
                            try { _scheduler.Schedule(current.Id, TimeSpan.FromSeconds(60)); }
                            catch (Exception ex)
                            {
                                _logger.LogError(ex, "Expiry reconciliation scheduling failed for {TicketId}; job must retry", current.Id);
                                return Fail("RESERVATION_LOCK_UNAVAILABLE", "Không thể lên lịch đối soát. Tác vụ cần thử lại.");
                            }
                        }
                        return state?.Status is "PAID" or "PROCESSING"
                            ? Fail("RESERVATION_PAYMENT_PROCESSING", "Thanh toán đang được xử lý; ghế chưa thể trả.")
                            : Fail("RESERVATION_PROVIDER_UNKNOWN", "Chưa xác nhận được trạng thái PayOS. Vui lòng thử lại.");
                    }
                }
            }
            else if (payment?.Status is "Success" or "OrphanedPaid")
                return Fail("RESERVATION_PAYMENT_PROCESSING", "Thanh toán đã được ghi nhận; ghế chưa thể trả.");
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
            if (!lease.IsValid || !paymentLease.IsValid) return Fail("RESERVATION_LOCK_LOST", "Khóa hủy giữ ghế đã hết hạn. Vui lòng thử lại.");
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
        }
    }

    private async Task<IDistributedLockLease?> TryAcquireAsync(string key, TimeSpan duration, CancellationToken cancellationToken)
    {
        try { return await _locks.AcquireLockAsync(key, duration, cancellationToken); }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
        catch (Exception ex) { _logger.LogWarning(ex, "Required reservation lock {LockKey} is unavailable", key); return null; }
    }

    private static ReservationResult Fail(string code, string message) => new(false, code, message);

    private static bool IsOrderCodeConflict(DbUpdateException exception) =>
        exception.ToString().Contains("IX_tickets_OrderCode", StringComparison.OrdinalIgnoreCase)
        || exception.ToString().Contains("OrderCode", StringComparison.OrdinalIgnoreCase);
}

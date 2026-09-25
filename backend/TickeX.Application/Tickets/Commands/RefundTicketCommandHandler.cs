using MediatR;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Interfaces;
using TickeX.Domain.Enums;
using TickeX.Domain.Entities;

namespace TickeX.Application.Tickets.Commands;

public class RefundTicketCommandHandler : IRequestHandler<RefundTicketCommand, RefundResult>
{
    private readonly IApplicationDbContext _context;
    private readonly IDistributedLockService _lockService;
    private readonly IRefundRequestPort _refundRequests;
    private readonly ITimePolicy _time;
    public RefundTicketCommandHandler(
        IApplicationDbContext context, 
        IDistributedLockService lockService,
        IRefundRequestPort refundRequests,
        ITimePolicy? time = null)
    {
        _context = context;
        _lockService = lockService;
        _refundRequests = refundRequests;
        _time = time ?? new UtcTimePolicy();
    }

    public async Task<RefundResult> Handle(RefundTicketCommand request, CancellationToken cancellationToken)
    {
        string lockKey = $"lock:refund:{request.TicketId}";
        
        // 1. Acquire distributed lock with 15-second timeout
        IDistributedLockLease? lease;
        try
        {
            lease = await _lockService.AcquireLockAsync(lockKey, TimeSpan.FromSeconds(15), cancellationToken);
        }
        catch (Exception)
        {
            // Refund is a financial operation. If the distributed lock is
            // unavailable, fail closed instead of relying on an uncoordinated
            // fallback that can race with check-in or another refund request.
            return new RefundResult(
                false,
                "Không thể khóa thao tác hoàn tiền lúc này. Vui lòng thử lại.",
                Code: "REFUND_LOCK_UNAVAILABLE");
        }

        if (lease is null)
        {
            return new RefundResult(
                false,
                "Yêu cầu hoàn tiền cho vé này đang được xử lý, vui lòng thử lại sau.",
                Code: "REFUND_LOCK_UNAVAILABLE");
        }

        try
        {
        await using (lease)
        {
            // 2. Reload Ticket from DB with Seat and Event included
            var ticket = await _context.Tickets
                .Include(t => t.Seat)
                .Include(t => t.Event)
                .FirstOrDefaultAsync(t => t.Id == request.TicketId, cancellationToken);

            if (ticket == null)
            {
                return new RefundResult(false, "Không tìm thấy thông tin vé.", Code: "REFUND_TICKET_NOT_FOUND");
            }

            // Verify ownership (unless Admin)
            if (request.UserId != Guid.Empty && ticket.UserId != request.UserId)
            {
                return new RefundResult(false, "Bạn không có quyền yêu cầu hoàn tiền cho vé của người khác.", Code: "REFUND_FORBIDDEN");
            }

            // 3. Validation Rules
            if (ticket.Status == TicketStatus.Used)
            {
                return new RefundResult(false, "Vé đã được sử dụng check-in tại sự kiện, không thể hoàn tiền!", Code: "REFUND_TICKET_USED");
            }

            if (ticket.Status == TicketStatus.Cancelled)
            {
                return new RefundResult(false, "Vé này đã bị hủy hoặc đã được hoàn tiền trước đó.", Code: "REFUND_ALREADY_CANCELLED");
            }

            if (ticket.Status == TicketStatus.RefundPending)
            {
                return new RefundResult(true, "Yêu cầu hoàn tiền đang chờ xử lý.", ticket.Price, "REFUND_PENDING");
            }

            if (ticket.Status != TicketStatus.Paid)
            {
                return new RefundResult(false, $"Chỉ có vé đã thanh toán (Paid) mới được hoàn tiền. Trạng thái hiện tại: {ticket.Status}", Code: "REFUND_TICKET_NOT_PAID");
            }

            if (ticket.Event == null)
            {
                return new RefundResult(false, "Không tìm thấy thông tin sự kiện gắn với vé.", Code: "REFUND_EVENT_NOT_FOUND");
            }

            var destination = await _context.RefundBankAccounts.AsNoTracking()
                .SingleOrDefaultAsync(x => x.UserId == ticket.UserId, cancellationToken);
            if (destination is null)
                return new RefundResult(false, "Hãy thiết lập tài khoản ngân hàng nhận tiền trong hồ sơ trước khi yêu cầu hoàn tiền.", Code: "REFUND_DESTINATION_REQUIRED");

            // Validate cutoff time (Event.RefundCutoffHours)
            var cutoffHours = ticket.Event.RefundCutoffHours > 0 ? ticket.Event.RefundCutoffHours : 24;
            var eventStartTime = ticket.Event.Date;
            var allowedUntil = eventStartTime.AddHours(-cutoffHours);

            if (_time.UtcNow > allowedUntil)
            {
                return new RefundResult(
                    false, 
                    $"Đã quá hạn hoàn vé! Theo chính sách sự kiện, chỉ được hoàn vé trước giờ bắt đầu {cutoffHours} tiếng (hạn chót: {allowedUntil:dd/MM/yyyy HH:mm}).",
                    Code: "REFUND_CUTOFF_EXPIRED");
            }

            decimal refundAmount = ticket.Price;
            if (!lease.IsValid)
                return new RefundResult(false, "Khóa xử lý đã hết hạn. Vui lòng thử lại.", Code: "REFUND_LOCK_LOST");

            // 4. Record Initiated Transaction (Outbox pattern)
            var existingTx = await _context.PaymentTransactions
                .FirstOrDefaultAsync(pt => pt.OrderCode == ticket.OrderCode, cancellationToken);

            if (existingTx != null)
            {
                existingTx.MarkRefundInitiated($"Refund requested: {refundAmount:N0}đ");
            }

            ticket.MarkRefundPending();
            _context.AuditLogs.Add(new AuditLog(
                request.UserId == Guid.Empty ? null : request.UserId,
                request.ActorEmail,
                "CustomerRefundRequested",
                nameof(Ticket),
                ticket.Id.ToString(),
                beforeState: "Paid",
                afterState: System.Text.Json.JsonSerializer.Serialize(new { Status = "RefundPending", request.Reason }),
                ipAddress: request.IpAddress));
            if (!lease.IsValid)
                return new RefundResult(false, "Khóa xử lý đã hết hạn. Vui lòng thử lại.", Code: "REFUND_LOCK_LOST");
            var enqueueResult = await _refundRequests.EnqueueAsync(
                [new RefundEnqueueItem(
                    ticket.EventId,
                    ticket.Id,
                    ticket.Price,
                    $"customer-refund:{ticket.EventId:N}:ticket:{ticket.Id:N}",
                    destination.EncryptedPayload)],
                cancellationToken);
            return enqueueResult == RefundEnqueueResult.Created
                ? new RefundResult(true, "Yêu cầu hoàn tiền đang chờ xử lý.", refundAmount, "REFUND_PENDING")
                : await RecoverAuthoritativeResultAsync(request.TicketId, cancellationToken);
        }
        }
        catch (DbUpdateConcurrencyException)
        {
            return await RecoverAuthoritativeResultAsync(request.TicketId, cancellationToken);
        }
    }

    private async Task<RefundResult> RecoverAuthoritativeResultAsync(Guid ticketId, CancellationToken cancellationToken)
    {
        if (_context is DbContext dbContext) dbContext.ChangeTracker.Clear();
        var ticket = await _context.Tickets.AsNoTracking().FirstOrDefaultAsync(t => t.Id == ticketId, cancellationToken);
        var hasOutbox = await _context.RefundRequests.AsNoTracking().AnyAsync(r => r.TicketId == ticketId, cancellationToken);
        return ticket?.Status == TicketStatus.RefundPending && hasOutbox
            ? new RefundResult(true, "Yêu cầu hoàn tiền đang chờ xử lý.", ticket.Price, "REFUND_PENDING")
            : new RefundResult(false, "Dữ liệu hoàn tiền vừa thay đổi. Vui lòng tải lại.", Code: "REFUND_CONCURRENCY_CONFLICT");
    }
}

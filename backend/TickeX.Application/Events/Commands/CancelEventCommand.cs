using MediatR;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Common.Models;
using TickeX.Application.Interfaces;
using TickeX.Domain.Entities;
using TickeX.Domain.Enums;

namespace TickeX.Application.Events.Commands;

public record CancelEventCommand(
    Guid Id, 
    string Reason, 
    Guid? AdminUserId = null, 
    string AdminEmail = "admin@tickex.com", 
    string? IpAddress = null
) : IRequest<AdminOperationResult>;

public class CancelEventCommandHandler : IRequestHandler<CancelEventCommand, AdminOperationResult>
{
    private readonly IApplicationDbContext _context;
    private readonly IRefundRequestPort _refundRequestPort;

    public CancelEventCommandHandler(IApplicationDbContext context, IRefundRequestPort refundRequestPort)
    {
        _context = context;
        _refundRequestPort = refundRequestPort;
    }

    public async Task<AdminOperationResult> Handle(CancelEventCommand request, CancellationToken cancellationToken)
    {
        var ev = await _context.Events
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(e => e.Id == request.Id, cancellationToken);

        if (ev == null)
            return AdminOperationResult.NotFound("Không tìm thấy sự kiện.");

        if (ev.Status == EventStatus.Cancelled)
            return AdminOperationResult.BadRequest("Sự kiện này đã ở trạng thái Đã Hủy trước đó.", "EVENT_ALREADY_CANCELLED");

        if (ev.Status == EventStatus.Completed)
            return AdminOperationResult.BadRequest("Không thể hủy sự kiện đã kết thúc.", "EVENT_ALREADY_COMPLETED");

        var strategy = _context.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await _context.BeginTransactionAsync(cancellationToken);
            var beforeStatus = ev.Status.ToString();
            ev.Cancel();
            const int batchSize = 500;
            var refundedCount = 0;
            decimal refundPendingAmount = 0m;
            var releasedSeatCount = 0;

        while (true)
        {
            var tickets = await _context.Tickets
                .Where(t => t.EventId == request.Id && (t.Status == TicketStatus.Paid || t.Status == TicketStatus.Pending))
                .OrderBy(t => t.Id)
                .Take(batchSize)
                .ToListAsync(cancellationToken);
            if (tickets.Count == 0) break;

            var ticketIds = tickets.Select(t => t.Id).ToArray();
            var paymentRows = await _context.PaymentTransactions
                .Where(p => ticketIds.Contains(p.TicketId))
                .ToListAsync(cancellationToken);
            var paymentsByTicket = paymentRows
                .GroupBy(p => p.TicketId)
                .ToDictionary(g => g.Key, g => g.OrderByDescending(p => p.CreatedAt).First());
            var userIds = tickets.Where(t => t.Status == TicketStatus.Paid).Select(t => t.UserId).Distinct().ToArray();
            var destinations = await _context.RefundBankAccounts.AsNoTracking()
                .Where(x => userIds.Contains(x.UserId))
                .ToDictionaryAsync(x => x.UserId, x => x.EncryptedPayload, cancellationToken);
            var refundItems = new List<RefundEnqueueItem>();

            foreach (var ticket in tickets)
            {
                if (ticket.Status == TicketStatus.Paid)
                {
                    ticket.MarkRefundPending();
                    if (paymentsByTicket.TryGetValue(ticket.Id, out var payment))
                        payment.MarkRefundInitiated($"Event cancelled: {request.Reason}");

                    refundItems.Add(new RefundEnqueueItem(
                        request.Id,
                        ticket.Id,
                        ticket.Price,
                        $"event-cancel:{request.Id:N}:ticket:{ticket.Id:N}",
                        destinations.GetValueOrDefault(ticket.UserId)));
                    refundedCount++;
                    refundPendingAmount += ticket.Price;
                }
                else
                {
                    ticket.Cancel();
                }
            }

            if (refundItems.Count > 0)
            {
                var enqueueResult = await _refundRequestPort.EnqueueAsync(refundItems, cancellationToken);
                if (enqueueResult != RefundEnqueueResult.Created)
                    return AdminOperationResult.Conflict("Dữ liệu hoàn tiền vừa thay đổi. Vui lòng thử lại.", "REFUND_CONCURRENCY_CONFLICT");
            }
            else
            {
                await _context.SaveChangesAsync(cancellationToken);
            }

            DetachProcessedEntities();
        }

        while (true)
        {
            var seats = await _context.Seats
                .Where(s => s.EventId == request.Id && s.Status == SeatStatus.Locked)
                .OrderBy(s => s.Id)
                .Take(batchSize)
                .ToListAsync(cancellationToken);
            if (seats.Count == 0) break;

            foreach (var seat in seats) seat.Release();
            releasedSeatCount += seats.Count;
            await _context.SaveChangesAsync(cancellationToken);
            DetachProcessedEntities();
        }

        _context.AuditLogs.Add(new AuditLog(
            userId: request.AdminUserId,
            userEmail: request.AdminEmail,
            action: "CANCEL_EVENT",
            entityName: "Event",
            entityId: ev.Id.ToString(),
            beforeState: $"Status={beforeStatus}",
            afterState: $"Status=Cancelled,Reason={request.Reason},RefundPendingCount={refundedCount},RefundPendingAmount={refundPendingAmount},SeatsReleased={releasedSeatCount}",
            ipAddress: request.IpAddress));

        try
        {
            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return AdminOperationResult.Conflict(
                "Sự kiện vừa được cập nhật bởi quản trị viên khác. Vui lòng tải lại dữ liệu mới nhất.",
                "EVENT_CONCURRENCY_CONFLICT");
        }

            return AdminOperationResult.Ok($"Hủy sự kiện thành công. Đã tạo yêu cầu hoàn tiền cho {refundedCount} vé và giải phóng {releasedSeatCount} ghế chưa bán.");
        });
    }

    private void DetachProcessedEntities()
    {
        if (_context is not DbContext dbContext) return;

        foreach (var entry in dbContext.ChangeTracker.Entries()
                     .Where(entry => entry.Entity is Ticket or PaymentTransaction or RefundRequest or Seat)
                     .ToList())
        {
            entry.State = EntityState.Detached;
        }
    }
}

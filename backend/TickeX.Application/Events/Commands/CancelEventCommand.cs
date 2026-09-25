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

        var beforeStatus = ev.Status.ToString();
        ev.Cancel();

        // 1. Process all tickets for this event
        var tickets = await _context.Tickets
            .Where(t => t.EventId == request.Id)
            .ToListAsync(cancellationToken);

        int refundedCount = 0;
        decimal refundPendingAmount = 0m;
        var paymentRows = await _context.PaymentTransactions
            .Where(p => tickets.Select(t => t.Id).Contains(p.TicketId))
            .ToListAsync(cancellationToken);
        var paymentsByTicket = paymentRows
            .GroupBy(p => p.TicketId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(p => p.CreatedAt).First());
        var refundItems = new List<RefundEnqueueItem>();
        var userIds = tickets.Where(t => t.Status == TicketStatus.Paid).Select(t => t.UserId).Distinct().ToArray();
        var destinations = await _context.RefundBankAccounts.AsNoTracking()
            .Where(x => userIds.Contains(x.UserId))
            .ToDictionaryAsync(x => x.UserId, x => x.EncryptedPayload, cancellationToken);

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
            else if (ticket.Status == TicketStatus.Pending)
            {
                ticket.Cancel();
            }
        }

        // 2. Release only seats that were not sold; sold seats remain reserved until refund confirmation.
        var seats = await _context.Seats
            .Where(s => s.EventId == request.Id && s.Status == SeatStatus.Locked)
            .ToListAsync(cancellationToken);

        foreach (var seat in seats)
        {
            seat.Release();
        }

        // 3. Write AuditLog
        var audit = new AuditLog(
            userId: request.AdminUserId,
            userEmail: request.AdminEmail,
            action: "CANCEL_EVENT",
            entityName: "Event",
            entityId: ev.Id.ToString(),
            beforeState: $"Status={beforeStatus}",
            afterState: $"Status=Cancelled,Reason={request.Reason},RefundPendingCount={refundedCount},RefundPendingAmount={refundPendingAmount},SeatsReleased={seats.Count}",
            ipAddress: request.IpAddress
        );
        _context.AuditLogs.Add(audit);

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

        return AdminOperationResult.Ok($"Hủy sự kiện thành công. Đã tạo yêu cầu hoàn tiền cho {refundedCount} vé và giải phóng {seats.Count} ghế chưa bán.");
    }
}

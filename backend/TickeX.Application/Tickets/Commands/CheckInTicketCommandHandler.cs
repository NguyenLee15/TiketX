using MediatR;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Interfaces;
using TickeX.Domain.Entities;
using TickeX.Domain.Enums;

namespace TickeX.Application.Tickets.Commands;

public class CheckInTicketCommandHandler : IRequestHandler<CheckInTicketCommand, CheckInResult>
{
    private readonly IApplicationDbContext _context;
    private readonly ITicketSecurityService _ticketSecurityService;
    private readonly ITimePolicy _time;

    public CheckInTicketCommandHandler(IApplicationDbContext context, ITicketSecurityService ticketSecurityService, ITimePolicy? time = null)
    {
        _context = context;
        _ticketSecurityService = ticketSecurityService;
        _time = time ?? new UtcTimePolicy();
    }

    public async Task<CheckInResult> Handle(CheckInTicketCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.QrToken))
        {
            return new CheckInResult(false, "Mã QR soát vé không được để trống.", StatusCode: 400, Code: "QR_EMPTY");
        }

        // 1. Verify and parse signed QR Token (HMAC-SHA256 Signed Token only, no raw Guid bypass!)
        var qrResult = _ticketSecurityService.ValidateQrToken(request.QrToken.Trim());
        if (!qrResult.IsValid || qrResult.Payload == null)
        {
            return new CheckInResult(false, qrResult.Message, StatusCode: 400, Code: "QR_INVALID");
        }

        var payload = qrResult.Payload;
        var ticketId = payload.TicketId;

        try
        {
            // 2. Fetch ticket from DB with Event, Seat, and User
            var ticket = await _context.Tickets
                .Include(t => t.Event)
                .Include(t => t.Seat)
                .Include(t => t.User)
                .FirstOrDefaultAsync(t => t.Id == ticketId, cancellationToken);

            if (ticket == null)
            {
                return new CheckInResult(false, "Không tìm thấy thông tin vé trong hệ thống.", StatusCode: 404, Code: "TICKET_NOT_FOUND");
            }

            // 3. Cross-check payload with DB record
            if (ticket.EventId != payload.EventId || ticket.OrderCode != payload.OrderCode)
            {
                return new CheckInResult(false, "Thông tin mã vé không khớp với sự kiện hoặc mã đơn hàng trên hệ thống.", StatusCode: 400, Code: "QR_TICKET_MISMATCH");
            }

            // 4. Event lifecycle and timeframe validation
            if (ticket.Event == null)
            {
                return new CheckInResult(false, "Không tìm thấy thông tin sự kiện của vé.", StatusCode: 404, Code: "EVENT_NOT_FOUND");
            }

            if (ticket.Event.Status != EventStatus.Published && ticket.Event.Status != EventStatus.Completed)
            {
                return new CheckInResult(false, $"Sự kiện chưa được xuất bản hoặc đã bị hủy (Trạng thái: {ticket.Event.Status}).", StatusCode: 400, Code: "EVENT_NOT_ACTIVE");
            }

            var now = _time.UtcNow;
            var checkInStartTime = ticket.Event.Date.AddHours(-2);
            var checkInEndTime = ticket.Event.EndDate.AddHours(4);

            if (now < checkInStartTime)
            {
                return new CheckInResult(false, $"Chưa đến thời gian mở cổng soát vé. Cổng mở từ: {_time.ToLocal(checkInStartTime):dd/MM/yyyy HH:mm}.", StatusCode: 400, Code: "CHECKIN_NOT_OPEN");
            }

            if (now > checkInEndTime)
            {
                return new CheckInResult(false, $"Cổng soát vé đã đóng lúc {_time.ToLocal(checkInEndTime):dd/MM/yyyy HH:mm}.", StatusCode: 400, Code: "CHECKIN_CLOSED");
            }

            // 5. Staff event assignment check (Admins can check in any event, Staff must be assigned)
            if (!string.Equals(request.StaffRole, "Admin", StringComparison.OrdinalIgnoreCase))
            {
                var isAssigned = await _context.EventStaffAssignments
                    .AnyAsync(esa => esa.EventId == ticket.EventId && esa.StaffUserId == request.StaffUserId, cancellationToken);

                if (!isAssigned)
                {
                    return new CheckInResult(false, "Bạn không được phân công phụ trách soát vé cho sự kiện này.", StatusCode: 403, Code: "STAFF_NOT_ASSIGNED");
                }
            }

            // 6. Status validation
            if (ticket.Status == TicketStatus.Cancelled)
            {
                return new CheckInResult(
                    false, 
                    $"VÉ ĐÃ BỊ HỦY HOẶC HOÀN TIỀN! Số tiền hoàn: {ticket.RefundAmount:N0}đ lúc {ticket.RefundedAt:dd/MM/yyyy HH:mm}.",
                    StatusCode: 400,
                    Code: "TICKET_CANCELLED");
            }

            if (ticket.Status == TicketStatus.Used)
            {
                return new CheckInResult(
                    false, 
                    $"VÉ ĐÃ ĐƯỢC CHECK-IN TRƯỚC ĐÓ! Thời gian quét: {ticket.CheckedInAt:dd/MM/yyyy HH:mm:ss}.",
                    StatusCode: 409,
                    Code: "TICKET_ALREADY_USED");
            }

            if (ticket.Status == TicketStatus.RefundPending)
            {
                return new CheckInResult(false, "Vé đang chờ hoàn tiền và không thể check-in.", StatusCode: 409, Code: "TICKET_REFUND_PENDING");
            }

            if (ticket.Status != TicketStatus.Paid)
            {
                return new CheckInResult(false, $"Vé chưa thanh toán thành công (Trạng thái: {ticket.Status}).", StatusCode: 400, Code: "TICKET_NOT_PAID");
            }

            // 7. Mark as Checked In with Staff ID
            ticket.CheckIn(request.StaffUserId);

            // 8. Mask token and create AuditLog
            var rawToken = request.QrToken.Trim();
            var maskedToken = rawToken.Length > 12 
                ? $"{rawToken[..8]}...[REDACTED]" 
                : "[REDACTED]";

            var auditLog = new AuditLog(
                userId: request.StaffUserId,
                userEmail: request.StaffEmail,
                action: "CHECK_IN",
                entityName: "Ticket",
                entityId: ticket.Id.ToString(),
                beforeState: $"Status=Paid,OrderCode={ticket.OrderCode}",
                afterState: $"Status=Used,CheckedInAt={ticket.CheckedInAt:O},StaffUserId={request.StaffUserId},MaskedToken={maskedToken}",
                ipAddress: request.IpAddress
            );
            _context.AuditLogs.Add(auditLog);

            await _context.SaveChangesAsync(cancellationToken);

            var attendeeName = ticket.User?.Name ?? "Khách hàng TickeX";
            var attendeeEmail = ticket.User?.Email ?? "N/A";
            var eventTitle = ticket.Event?.Title ?? "Sự kiện TickeX";
            var row = ticket.Seat?.Row ?? "A";
            var number = ticket.Seat?.Number ?? 1;
            var tier = ticket.Seat?.Tier ?? SeatTier.Standard;

            var details = new TicketCheckInDetails(
                ticket.Id,
                ticket.EventId,
                eventTitle,
                attendeeName,
                attendeeEmail,
                row,
                number,
                tier,
                ticket.Price,
                ticket.OrderCode,
                ticket.CheckedInAt ?? _time.UtcNow
            );

            return new CheckInResult(
                true, 
                $"CHECK-IN THÀNH CÔNG! Chào mừng {attendeeName} - Ghế {row}{number} ({tier}).", 
                details,
                StatusCode: 200);
        }
        catch (DbUpdateConcurrencyException)
        {
            return new CheckInResult(
                false, 
                $"CẢNH BÁO XUNG ĐỘT: Vé vừa được xử lý bởi trạm soát vé khác lúc {_time.ToLocal(_time.UtcNow):HH:mm:ss}!",
                StatusCode: 409,
                Code: "CHECKIN_CONCURRENCY_CONFLICT");
        }
    }
}

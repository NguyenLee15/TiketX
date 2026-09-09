using MediatR;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Common.Models;
using TickeX.Application.Interfaces;
using TickeX.Domain.Entities;

namespace TickeX.Application.Events.Commands;

public record DeleteEventCommand(Guid Id, Guid? AdminUserId = null, string AdminEmail = "admin@tickex.com", string? IpAddress = null) : IRequest<AdminOperationResult>;

public class DeleteEventCommandHandler : IRequestHandler<DeleteEventCommand, AdminOperationResult>
{
    private readonly IApplicationDbContext _context;

    public DeleteEventCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<AdminOperationResult> Handle(DeleteEventCommand request, CancellationToken cancellationToken)
    {
        var ev = await _context.Events
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(e => e.Id == request.Id, cancellationToken);

        if (ev == null)
            return AdminOperationResult.NotFound("Không tìm thấy sự kiện cần xóa.");

        if (ev.IsDeleted)
            return AdminOperationResult.BadRequest("Sự kiện này đã được xóa trước đó.", "EVENT_ALREADY_DELETED");

        // Financial Invariant: Forbid deleting any event that has ANY associated tickets (Paid, Used, Cancelled, Pending)
        var hasTickets = await _context.Tickets
            .AnyAsync(t => t.EventId == request.Id, cancellationToken);

        if (hasTickets)
        {
            return AdminOperationResult.BadRequest(
                "Sự kiện đã phát sinh vé và chứng từ giao dịch lịch sử. Không thể xóa, vui lòng chuyển trạng thái sự kiện sang Đã Hủy.",
                "EVENT_HAS_ASSOCIATED_TICKETS"
            );
        }

        // Soft delete event
        ev.SoftDelete();

        var audit = new AuditLog(
            userId: request.AdminUserId,
            userEmail: request.AdminEmail,
            action: "DELETE_EVENT",
            entityName: "Event",
            entityId: ev.Id.ToString(),
            beforeState: $"Title={ev.Title},Status={ev.Status}",
            afterState: "IsDeleted=true",
            ipAddress: request.IpAddress
        );
        _context.AuditLogs.Add(audit);

        await _context.SaveChangesAsync(cancellationToken);

        return AdminOperationResult.Ok("Xóa sự kiện thành công.");
    }
}

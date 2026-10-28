using MediatR;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Admin;
using TickeX.Application.Common.Models;
using TickeX.Application.Interfaces;
using TickeX.Domain.Entities;

namespace TickeX.Application.Events.Commands;

public record DeleteEventCommand(
    Guid Id, 
    Guid? AdminUserId = null, 
    string AdminEmail = "admin@tickex.com", 
    string? IpAddress = null,
    string? ExpectedVersion = null
) : IRequest<AdminOperationResult>;

public class DeleteEventCommandHandler : IRequestHandler<DeleteEventCommand, AdminOperationResult>
{
    private readonly IApplicationDbContext _context;
    private readonly IDistributedLockService? _lockService;

    public DeleteEventCommandHandler(IApplicationDbContext context, IDistributedLockService? lockService = null)
    {
        _context = context;
        _lockService = lockService;
    }

    public async Task<AdminOperationResult> Handle(DeleteEventCommand request, CancellationToken cancellationToken)
    {
        IDistributedLockLease? eventLease = null;
        if (_lockService is not null)
        {
            try
            {
                eventLease = await _lockService.AcquireLockAsync(
                    $"event:cancel:{request.Id:N}", TimeSpan.FromSeconds(30), cancellationToken);
            }
            catch
            {
                return AdminOperationResult.Conflict("Không thể khóa thao tác xóa sự kiện lúc này. Vui lòng thử lại.", "EVENT_LOCK_UNAVAILABLE");
            }

            if (eventLease is null || !eventLease.IsValid)
            {
                if (eventLease is not null) await eventLease.DisposeAsync();
                return AdminOperationResult.Conflict("Thao tác xóa sự kiện đang được xử lý. Vui lòng thử lại.", "EVENT_LOCK_UNAVAILABLE");
            }
        }

        await using (eventLease)
        {
            var ev = await _context.Events
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(e => e.Id == request.Id, cancellationToken);

            if (ev == null)
                return AdminOperationResult.NotFound("Không tìm thấy sự kiện cần xóa.");

            if (ev.IsDeleted)
                return AdminOperationResult.BadRequest("Sự kiện này đã được xóa trước đó.", "EVENT_ALREADY_DELETED");

            if (!string.IsNullOrWhiteSpace(request.ExpectedVersion))
            {
                if (!AdminMutationVersionPolicy.TryDecodeRequiredVersion(request.ExpectedVersion, out var expectedBytes))
                    return AdminOperationResult.BadRequest("ExpectedVersion không hợp lệ.", "INVALID_VERSION");

                if (!ev.Version.SequenceEqual(expectedBytes))
                    return AdminOperationResult.Conflict(
                        "Sự kiện vừa được cập nhật bởi quản trị viên khác. Vui lòng tải lại dữ liệu mới nhất.",
                        "EVENT_CONCURRENCY_CONFLICT");
            }

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

            try
            {
                await _context.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateConcurrencyException)
            {
                return AdminOperationResult.Conflict(
                    "Sự kiện vừa được cập nhật bởi quản trị viên khác. Vui lòng tải lại dữ liệu mới nhất.",
                    "EVENT_CONCURRENCY_CONFLICT");
            }

            return AdminOperationResult.Ok("Xóa sự kiện thành công.");
        }
    }
}

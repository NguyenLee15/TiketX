using MediatR;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Admin;
using TickeX.Application.Common.Models;
using TickeX.Application.Interfaces;
using TickeX.Domain.Entities;
using TickeX.Domain.Enums;

namespace TickeX.Application.Events.Commands;

public record UpdateEventCommand(
    Guid Id,
    string Title,
    string Description,
    DateTime Date,
    DateTime EndDate,
    string Location,
    string VenueName,
    int TotalSeats,
    string Category,
    string ImageUrl,
    string BannerUrl = "",
    string OrganizerName = "TickeX Live",
    decimal BasePrice = 200000m,
    EventStatus Status = EventStatus.Published,
    int RefundCutoffHours = 24,
    Guid? AdminUserId = null,
    string AdminEmail = "admin@tickex.com",
    string? IpAddress = null,
    string? ExpectedVersion = null
) : IRequest<AdminOperationResult>;

public class UpdateEventCommandHandler : IRequestHandler<UpdateEventCommand, AdminOperationResult>
{
    private readonly IApplicationDbContext _context;

    public UpdateEventCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<AdminOperationResult> Handle(UpdateEventCommand request, CancellationToken cancellationToken)
    {
        var ev = await _context.Events
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(e => e.Id == request.Id, cancellationToken);

        if (ev == null)
            return AdminOperationResult.NotFound("Không tìm thấy sự kiện.");

        if (ev.IsDeleted)
            return AdminOperationResult.BadRequest("Không thể cập nhật sự kiện đã bị xóa.", "EVENT_DELETED");

        if (!string.IsNullOrWhiteSpace(request.ExpectedVersion))
        {
            if (AdminMutationVersionPolicy.TryDecodeRequiredVersion(request.ExpectedVersion, out var expectedBytes))
            {
                if (!ev.Version.SequenceEqual(expectedBytes))
                {
                    return AdminOperationResult.Conflict(
                        "Sự kiện vừa được cập nhật bởi quản trị viên khác. Vui lòng tải lại dữ liệu mới nhất.",
                        "EVENT_CONCURRENCY_CONFLICT");
                }
            }
            else
            {
                return AdminOperationResult.BadRequest(
                    "Phiên bản dữ liệu sự kiện không hợp lệ.",
                    "INVALID_VERSION");
            }
        }

        // Invariant check: any ticket/reservation history freezes financial and seat geometry fields.
        var hasSoldTickets = await _context.Tickets
            .AnyAsync(t => t.EventId == request.Id, cancellationToken);

        if (hasSoldTickets)
        {
            if (request.Date != default && request.Date != ev.Date)
            {
                return AdminOperationResult.BadRequest(
                    "Không thể thay đổi thời gian sự kiện sau khi đã phát sinh vé bán ra.",
                    "CANNOT_MODIFY_DATE_AFTER_SALES");
            }

            if (request.TotalSeats > 0 && request.TotalSeats != ev.TotalSeats)
            {
                return AdminOperationResult.BadRequest(
                    "Không thể thay đổi số lượng ghế sau khi sự kiện đã phát sinh vé bán ra.",
                    "CANNOT_MODIFY_SEATS_AFTER_SALES"
                );
            }

            if (request.BasePrice > 0 && request.BasePrice != ev.BasePrice)
            {
                return AdminOperationResult.BadRequest(
                    "Không thể thay đổi giá vé cơ sở sau khi sự kiện đã phát sinh vé bán ra.",
                    "CANNOT_MODIFY_PRICE_AFTER_SALES"
                );
            }
        }

        var beforeState = $"Title={ev.Title},Date={ev.Date:O},Status={ev.Status},BasePrice={ev.BasePrice}";

        ev.Update(
            request.Title,
            request.Description,
            request.Date,
            request.EndDate,
            request.Location,
            request.VenueName,
            request.TotalSeats,
            request.Category,
            request.ImageUrl,
            request.BannerUrl,
            request.OrganizerName,
            request.BasePrice,
            request.Status,
            request.RefundCutoffHours);

        var audit = new AuditLog(
            userId: request.AdminUserId,
            userEmail: request.AdminEmail,
            action: "UPDATE_EVENT",
            entityName: "Event",
            entityId: ev.Id.ToString(),
            beforeState: beforeState,
            afterState: $"Title={ev.Title},Date={ev.Date:O},Status={ev.Status},BasePrice={ev.BasePrice}",
            ipAddress: request.IpAddress
        );
        _context.AuditLogs.Add(audit);

        await _context.SaveChangesAsync(cancellationToken);

        return AdminOperationResult.Ok("Cập nhật sự kiện thành công.");
    }
}

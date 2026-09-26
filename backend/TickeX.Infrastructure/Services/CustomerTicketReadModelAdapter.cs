using Microsoft.EntityFrameworkCore;
using TickeX.Application.Interfaces;
using TickeX.Application.Tickets.Queries;
using TickeX.Domain.Entities;
using TickeX.Domain.Enums;

namespace TickeX.Infrastructure.Services;

public sealed class CustomerTicketReadModelAdapter : ICustomerTicketReadModel
{
    private readonly IApplicationDbContext _context;
    private readonly ITimePolicy _time;

    public CustomerTicketReadModelAdapter(IApplicationDbContext context, ITimePolicy time)
    {
        _context = context;
        _time = time;
    }

    public async Task<IReadOnlyList<TicketDto>> GetForUserAsync(Guid userId, int? page = null, int? pageSize = null, string? status = null, CancellationToken cancellationToken = default)
    {
        IQueryable<Ticket> query = _context.Tickets
            .AsNoTracking()
            .Include(t => t.Event)
            .Include(t => t.Seat)
            .Where(t => t.UserId == userId);

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<TicketStatus>(status, true, out var parsedStatus))
        {
            query = query.Where(t => t.Status == parsedStatus);
        }

        query = query
            .OrderByDescending(t => t.CreatedAt)
            .ThenByDescending(t => t.Id);

        var effectivePage = page ?? 1;
        var effectivePageSize = pageSize ?? 10;
        if (effectivePage < 1 || effectivePageSize is < 1 or > 50)
            throw new ArgumentOutOfRangeException(nameof(page), "page must be positive and pageSize must be between 1 and 50.");
        var offset = checked(((long)effectivePage - 1) * effectivePageSize);
        if (offset > int.MaxValue)
            throw new ArgumentOutOfRangeException(nameof(page), "page offset exceeds the supported range.");
        query = query
            .Skip((int)offset)
            .Take(effectivePageSize);

        var tickets = await query.ToListAsync(cancellationToken);
        var ticketIds = tickets.Select(t => t.Id).ToArray();
        var refundStatuses = await _context.RefundRequests.AsNoTracking()
            .Where(r => ticketIds.Contains(r.TicketId))
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new { r.TicketId, r.Status })
            .ToListAsync(cancellationToken);
        var latestRefundStatus = refundStatuses.GroupBy(r => r.TicketId)
            .ToDictionary(g => g.Key, g => g.First().Status);

        var now = _time.UtcNow;
        var result = new List<TicketDto>(tickets.Count);
        foreach (var ticket in tickets)
        {
            if (ticket.Event == null || ticket.Seat == null) continue;

            var cutoffHours = ticket.Event.RefundCutoffHours > 0 ? ticket.Event.RefundCutoffHours : 24;
            var allowedUntil = ticket.Event.Date.AddHours(-cutoffHours);
            var canRefund = ticket.Status == TicketStatus.Paid && now <= allowedUntil;

            result.Add(new TicketDto(
                ticket.Id,
                ticket.EventId,
                ticket.SeatId,
                ticket.Event.Title,
                ticket.Event.Description,
                ticket.Event.Date,
                ticket.Event.EndDate,
                ticket.Event.Location,
                ticket.Event.VenueName,
                ticket.Event.Category,
                ticket.Event.ImageUrl,
                ticket.Seat.Row,
                ticket.Seat.Number,
                ticket.Seat.Tier,
                ticket.Price,
                ticket.Status.ToString(),
                ticket.OrderCode,
                ticket.QrCodeSignature,
                ticket.PaidAt,
                ticket.CheckedInAt,
                ticket.RefundAmount,
                ticket.RefundedAt,
                cutoffHours,
                canRefund,
                latestRefundStatus.GetValueOrDefault(ticket.Id)));
        }

        return result;
    }
}

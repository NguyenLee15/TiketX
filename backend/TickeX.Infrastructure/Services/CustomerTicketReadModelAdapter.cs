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

    public async Task<IReadOnlyList<TicketDto>> GetForUserAsync(Guid userId, int? page = null, int? pageSize = null, CancellationToken cancellationToken = default)
    {
        IQueryable<Ticket> query = _context.Tickets
            .AsNoTracking()
            .Include(t => t.Event)
            .Include(t => t.Seat)
            .Where(t => t.UserId == userId)
            .OrderByDescending(t => t.CreatedAt);

        if (page.HasValue && page.Value > 0)
        {
            var clampedSize = Math.Clamp(pageSize ?? 10, 1, 50);
            query = query.Skip((page.Value - 1) * clampedSize).Take(clampedSize);
        }

        var tickets = await query.ToListAsync(cancellationToken);

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
                canRefund));
        }

        return result;
    }
}

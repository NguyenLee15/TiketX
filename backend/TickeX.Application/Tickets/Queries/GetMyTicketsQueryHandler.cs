using MediatR;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Interfaces;
using TickeX.Domain.Enums;

namespace TickeX.Application.Tickets.Queries;

public class GetMyTicketsQueryHandler : IRequestHandler<GetMyTicketsQuery, List<TicketDto>>
{
    private readonly IApplicationDbContext _context;
    public GetMyTicketsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<TicketDto>> Handle(GetMyTicketsQuery request, CancellationToken cancellationToken)
    {
        var tickets = await _context.Tickets
            .Include(t => t.Event)
            .Include(t => t.Seat)
            .Where(t => t.UserId == request.UserId)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync(cancellationToken);

        var result = new List<TicketDto>();

        foreach (var t in tickets)
        {
            if (t.Event == null || t.Seat == null) continue;

            // Calculate refund eligibility
            var cutoffHours = t.Event.RefundCutoffHours > 0 ? t.Event.RefundCutoffHours : 24;
            var allowedUntil = t.Event.Date.AddHours(-cutoffHours);
            bool canRefund = t.Status == TicketStatus.Paid && DateTime.UtcNow <= allowedUntil;

            result.Add(new TicketDto(
                t.Id,
                t.EventId,
                t.SeatId,
                t.Event.Title,
                t.Event.Description,
                t.Event.Date,
                t.Event.EndDate,
                t.Event.Location,
                t.Event.VenueName,
                t.Event.Category,
                t.Event.ImageUrl,
                t.Seat.Row,
                t.Seat.Number,
                t.Seat.Tier,
                t.Price,
                t.Status.ToString(),
                t.OrderCode,
                t.QrCodeSignature,
                t.PaidAt,
                t.CheckedInAt,
                t.RefundAmount,
                t.RefundedAt,
                cutoffHours,
                canRefund
            ));
        }

        return result;
    }
}

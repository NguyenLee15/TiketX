using MediatR;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Interfaces;
using TickeX.Domain.Enums;
using Microsoft.Extensions.Options;
using TickeX.Application.Seats;

namespace TickeX.Application.Events.Queries;

public class GetEventWithSeatsQueryHandler : IRequestHandler<GetEventWithSeatsQuery, EventDetailDto?>
{
    private readonly IApplicationDbContext _context;
    private readonly TimeSpan _holdDuration;
    private readonly ITimePolicy _time;

    public GetEventWithSeatsQueryHandler(IApplicationDbContext context, IOptions<ReservationOptions>? options = null, ITimePolicy? time = null)
    {
        _context = context;
        _holdDuration = TimeSpan.FromMinutes(options?.Value.HoldMinutes ?? new ReservationOptions().HoldMinutes);
        _time = time ?? new UtcTimePolicy();
    }

    public async Task<EventDetailDto?> Handle(GetEventWithSeatsQuery request, CancellationToken cancellationToken)
    {
        var e = await _context.Events
            .Include(x => x.Seats)
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.EventId, cancellationToken);

        if (e == null || e.IsDeleted || e.Status != EventStatus.Published || e.Date <= _time.UtcNow) return null;

        var seats = e.Seats
            .OrderBy(s => s.Row)
            .ThenBy(s => s.Number)
            .Select(s => new SeatDto(
                s.Id, 
                s.EventId, 
                s.Row, 
                s.Number, 
                s.Tier, 
                s.Status, 
                s.Price, 
                Convert.ToBase64String(s.Version),
                s.LockedByUserId.HasValue && request.CurrentUserId.HasValue && s.LockedByUserId.Value == request.CurrentUserId.Value))
            .ToList();

        // Treat stale locks as available immediately; the background job is only cleanup.
        var lockExpiry = _time.UtcNow.Subtract(_holdDuration);
        seats = seats.Select(s => s.Status == SeatStatus.Locked && e.Seats.First(raw => raw.Id == s.Id).LockedAt <= lockExpiry
            ? s with { Status = SeatStatus.Available, IsLockedByCurrentUser = false }
            : s).ToList();

        var availableCount = seats.Count(s => s.Status == SeatStatus.Available);
        var minPrice = seats.Any() ? seats.Min(s => s.Price) : e.BasePrice;
        var maxPrice = seats.Any() ? seats.Max(s => s.Price) : e.BasePrice;
        
        return new EventDetailDto(
            e.Id, 
            e.Title, 
            e.Description, 
            e.Date, 
            e.EndDate,
            e.Location, 
            e.VenueName,
            e.Category,
            e.ImageUrl, 
            e.BannerUrl,
            e.OrganizerName,
            e.TotalSeats,
            availableCount,
            e.BasePrice,
            minPrice,
            maxPrice,
            e.Status,
            e.RefundCutoffHours,
            seats
        );
    }
}

using MediatR;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Interfaces;
using TickeX.Domain.Enums;

namespace TickeX.Application.Events.Queries;

public class GetEventsQueryHandler : IRequestHandler<GetEventsQuery, PagedResult<EventDto>>
{
    private readonly IApplicationDbContext _context;

    public GetEventsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<PagedResult<EventDto>> Handle(GetEventsQuery request, CancellationToken cancellationToken)
    {
        var query = _context.Events
            .AsNoTracking()
            .Where(e => e.Status == EventStatus.Published && !e.IsDeleted && e.Date > DateTime.UtcNow);

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var search = request.Search.Trim();
            query = query.Where(e => 
                EF.Functions.Like(e.Title, $"%{search}%") || 
                EF.Functions.Like(e.Description, $"%{search}%") || 
                EF.Functions.Like(e.Location, $"%{search}%") ||
                EF.Functions.Like(e.VenueName, $"%{search}%") ||
                EF.Functions.Like(e.OrganizerName, $"%{search}%"));
        }

        if (!string.IsNullOrWhiteSpace(request.Category) && request.Category != "All")
        {
            query = query.Where(e => e.Category == request.Category);
        }

        if (request.DateFrom.HasValue)
        {
            query = query.Where(e => e.Date >= request.DateFrom.Value);
        }

        if (request.DateTo.HasValue)
        {
            query = query.Where(e => e.Date <= request.DateTo.Value);
        }

        int totalCount = await query.CountAsync(cancellationToken);

        // Sorting
        query = request.SortBy switch
        {
            "date_desc" => query.OrderByDescending(e => e.Date),
            "price_asc" => query.OrderBy(e => e.BasePrice),
            "price_desc" => query.OrderByDescending(e => e.BasePrice),
            _ => query.OrderBy(e => e.Date)
        };

        var page = request.Page > 0 ? request.Page : 1;
        var pageSize = Math.Clamp(request.PageSize > 0 ? request.PageSize : 12, 1, 50);

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(e => new EventDto(
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
                e.Seats.Count(s => s.Status == SeatStatus.Available),
                e.BasePrice,
                e.Seats.Any() ? (decimal)e.Seats.Min(s => (double)s.Price) : e.BasePrice,
                e.Seats.Any() ? (decimal)e.Seats.Max(s => (double)s.Price) : e.BasePrice,
                e.Status,
                e.RefundCutoffHours,
                false
            ))
            .ToListAsync(cancellationToken);

        return new PagedResult<EventDto>(items, totalCount, page, pageSize);
    }
}

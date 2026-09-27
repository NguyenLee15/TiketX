using MediatR;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Interfaces;
using TickeX.Domain.Enums;

namespace TickeX.Application.Events.Queries;

public record GetAdminEventsQuery(
    string? Search = null,
    string? Category = null,
    EventStatus? Status = null,
    bool IncludeDeleted = false,
    bool DeletedOnly = false,
    int Page = 1,
    int PageSize = 10
) : IRequest<PagedResult<EventDto>>;

public class GetAdminEventsQueryHandler : IRequestHandler<GetAdminEventsQuery, PagedResult<EventDto>>
{
    private readonly IApplicationDbContext _context;

    public GetAdminEventsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<PagedResult<EventDto>> Handle(GetAdminEventsQuery request, CancellationToken cancellationToken)
    {
        var page = Math.Clamp(request.Page > 0 ? request.Page : 1, 1, 10000);
        var pageSize = request.PageSize switch
        {
            < 1 => 10,
            > 100 => 100,
            _ => request.PageSize
        };

        var query = _context.Events
            .IgnoreQueryFilters()
            .AsNoTracking();

        if (request.DeletedOnly)
            query = query.Where(e => e.IsDeleted);
        else if (!request.IncludeDeleted)
            query = query.Where(e => !e.IsDeleted);

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var search = request.Search.Trim();
            if (search.Length > 100)
            {
                search = search.Substring(0, 100);
            }
            var pattern = $"%{search}%";
            query = query.Where(e => EF.Functions.Like(e.Title, pattern) || EF.Functions.Like(e.Location, pattern));
        }

        if (!string.IsNullOrWhiteSpace(request.Category))
        {
            query = query.Where(e => e.Category == request.Category);
        }

        if (request.Status.HasValue)
        {
            query = query.Where(e => e.Status == request.Status.Value);
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var rawEvents = await query
            .OrderByDescending(e => e.Date)
            .ThenBy(e => e.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(e => new {
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
                e.BasePrice,
                MinPrice = e.BasePrice * 0.75m,
                MaxPrice = e.BasePrice * 1.75m,
                e.Status,
                e.RefundCutoffHours,
                e.IsDeleted,
                e.Version
            })
            .ToListAsync(cancellationToken);

        var eventIds = rawEvents.Select(e => e.Id).ToArray();
        var availableSeats = await _context.Seats
            .Where(s => eventIds.Contains(s.EventId) && s.Status == SeatStatus.Available)
            .GroupBy(s => s.EventId)
            .Select(g => new { EventId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.EventId, x => x.Count, cancellationToken);
        var ticketHistoryIds = await _context.Tickets
            .Where(t => eventIds.Contains(t.EventId))
            .Select(t => t.EventId)
            .Distinct()
            .ToListAsync(cancellationToken);
        var ticketHistory = ticketHistoryIds.ToHashSet();

        var events = rawEvents.Select(e => new EventDto(
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
            availableSeats.GetValueOrDefault(e.Id),
            e.BasePrice,
            e.MinPrice,
            e.MaxPrice,
            e.Status,
            e.RefundCutoffHours,
            e.IsDeleted,
            ticketHistory.Contains(e.Id),
            e.Version != null && e.Version.Length > 0 ? Convert.ToBase64String(e.Version) : null
        )).ToList();

        return new PagedResult<EventDto>(events, totalCount, page, pageSize);
    }
}

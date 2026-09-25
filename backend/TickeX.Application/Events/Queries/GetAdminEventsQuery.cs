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
        var page = request.Page < 1 ? 1 : request.Page;
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

        var events = await query
            .OrderByDescending(e => e.Date)
            .ThenBy(e => e.Id)
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
                _context.Seats.Count(s => s.EventId == e.Id && s.Status == SeatStatus.Available),
                e.BasePrice,
                e.BasePrice * 0.75m,
                e.BasePrice * 1.75m,
                e.Status,
                e.RefundCutoffHours,
                e.IsDeleted,
                _context.Tickets.Any(t => t.EventId == e.Id)
            ))
            .ToListAsync(cancellationToken);

        return new PagedResult<EventDto>(events, totalCount, page, pageSize);
    }
}

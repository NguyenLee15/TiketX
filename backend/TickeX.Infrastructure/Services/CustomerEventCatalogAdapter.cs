using Microsoft.EntityFrameworkCore;
using System.Text;
using System.Text.Json;
using TickeX.Application.Events.Queries;
using TickeX.Application.Interfaces;
using TickeX.Domain.Enums;

namespace TickeX.Infrastructure.Services;

public sealed class CustomerEventCatalogAdapter : ICustomerEventCatalog
{
    private readonly IApplicationDbContext _context;
    private readonly ITimePolicy _time;
    private readonly ICustomerEventCatalogCache? _cache;

    public CustomerEventCatalogAdapter(IApplicationDbContext context, ITimePolicy time, ICustomerEventCatalogCache? cache = null)
    {
        _context = context;
        _time = time;
        _cache = cache;
    }

    public async Task<PagedResult<EventDto>> SearchAsync(GetEventsQuery request, CancellationToken cancellationToken)
    {
        var cached = _cache is null ? null : await _cache.GetAsync(request, cancellationToken);
        if (cached is not null) return cached;

        var now = _time.UtcNow;
        var query = _context.Events.AsNoTracking()
            .Include(e => e.Seats)
            .Where(e => e.Status == EventStatus.Published && !e.IsDeleted && e.Date > now);

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var search = request.Search.Trim();
            if (search.Length > 100) search = search[..100];
            query = query.Where(e => EF.Functions.Like(e.Title, $"%{search}%")
                || EF.Functions.Like(e.Description, $"%{search}%")
                || EF.Functions.Like(e.Location, $"%{search}%")
                || EF.Functions.Like(e.VenueName, $"%{search}%")
                || EF.Functions.Like(e.OrganizerName, $"%{search}%"));
        }

        if (!string.IsNullOrWhiteSpace(request.Category)
            && !string.Equals(request.Category.Trim(), "All", StringComparison.OrdinalIgnoreCase))
            query = query.Where(e => e.Category == request.Category);
        if (request.DateFrom.HasValue) query = query.Where(e => e.Date >= request.DateFrom.Value);
        if (request.DateTo.HasValue) query = query.Where(e => e.Date <= request.DateTo.Value);

        var sortBy = request.SortBy is "date_desc" or "price_asc" or "price_desc" ? request.SortBy : "date_asc";
        query = sortBy switch
        {
            "date_desc" => query.OrderByDescending(e => e.Date).ThenBy(e => e.Id),
            "price_asc" => query.OrderBy(e => e.BasePrice).ThenBy(e => e.Id),
            "price_desc" => query.OrderByDescending(e => e.BasePrice).ThenBy(e => e.Id),
            _ => query.OrderBy(e => e.Date).ThenBy(e => e.Id)
        };

        var page = Math.Clamp(request.Page > 0 ? request.Page : 1, 1, 10000);
        var pageSize = Math.Clamp(request.Limit ?? request.PageSize, 1, 50);
        int? totalCount = null;
        List<TickeX.Domain.Entities.Event> rows;
        if (string.IsNullOrWhiteSpace(request.Cursor))
        {
            totalCount = await query.CountAsync(cancellationToken);
            rows = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(cancellationToken);
        }
        else
        {
            var cursor = DecodeCursor(request.Cursor, sortBy);
            query = sortBy switch
            {
                "date_desc" => query.Where(e => e.Date < cursor.Date || (e.Date == cursor.Date && e.Id.CompareTo(cursor.Id) > 0)),
                "price_asc" => query.Where(e => e.BasePrice > cursor.Price || (e.BasePrice == cursor.Price && e.Id.CompareTo(cursor.Id) > 0)),
                "price_desc" => query.Where(e => e.BasePrice < cursor.Price || (e.BasePrice == cursor.Price && e.Id.CompareTo(cursor.Id) > 0)),
                _ => query.Where(e => e.Date > cursor.Date || (e.Date == cursor.Date && e.Id.CompareTo(cursor.Id) > 0))
            };
            rows = await query.Take(pageSize + 1).ToListAsync(cancellationToken);
        }

        var hasMore = rows.Count > pageSize;
        if (hasMore) rows.RemoveAt(pageSize);
        var items = rows
            .Select(e => new EventDto(
                e.Id, e.Title, e.Description, e.Date, e.EndDate, e.Location, e.VenueName,
                e.Category, e.ImageUrl, e.BannerUrl, e.OrganizerName, e.TotalSeats,
                e.Seats.Count(s => s.Status == SeatStatus.Available), e.BasePrice,
                e.Seats.Any() ? (decimal)e.Seats.Min(s => (double)s.Price) : e.BasePrice,
                e.Seats.Any() ? (decimal)e.Seats.Max(s => (double)s.Price) : e.BasePrice,
                e.Status, e.RefundCutoffHours, false, false, null))
            .ToList();

        var last = rows.LastOrDefault();
        var nextCursor = hasMore && last is not null ? EncodeCursor(sortBy, last) : null;
        var result = string.IsNullOrWhiteSpace(request.Cursor)
            ? new PagedResult<EventDto>(items, totalCount, page, pageSize, nextCursor, hasMore, "offset")
            : new PagedResult<EventDto>(items, null, null, pageSize, nextCursor, hasMore, "cursor");
        if (_cache is not null) await _cache.SetAsync(request, result, cancellationToken);
        return result;
    }

    private static string EncodeCursor(string sortBy, TickeX.Domain.Entities.Event eventItem)
    {
        var value = new EventCursor(sortBy, eventItem.Date, eventItem.BasePrice, eventItem.Id);
        return Convert.ToBase64String(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(value)))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    private static EventCursor DecodeCursor(string encoded, string sortBy)
    {
        try
        {
            var padded = encoded.Replace('-', '+').Replace('_', '/');
            padded += new string('=', (4 - padded.Length % 4) % 4);
            var cursor = JsonSerializer.Deserialize<EventCursor>(Convert.FromBase64String(padded));
            if (cursor is null || cursor.SortBy != sortBy || cursor.Id == Guid.Empty)
                throw new ArgumentException("Cursor không hợp lệ.", nameof(encoded));
            return cursor;
        }
        catch (JsonException ex)
        {
            throw new ArgumentException("Cursor không hợp lệ.", nameof(encoded), ex);
        }
        catch (FormatException ex)
        {
            throw new ArgumentException("Cursor không hợp lệ.", nameof(encoded), ex);
        }
    }

    private sealed record EventCursor(string SortBy, DateTime Date, decimal Price, Guid Id);
}

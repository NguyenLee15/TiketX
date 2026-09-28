using Microsoft.EntityFrameworkCore;
using System.Text;
using System.Text.Json;
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

        var now = _time.UtcNow;
        return tickets.Select(ticket => ToDto(ticket, now)).Where(ticket => ticket is not null).Cast<TicketDto>().ToList();
    }

    public async Task<TicketCursorPage> GetForUserCursorAsync(Guid userId, string? cursor, int limit, string? status, CancellationToken cancellationToken = default)
    {
        if (limit is < 1 or > 50)
            throw new ArgumentOutOfRangeException(nameof(limit), "limit must be between 1 and 50.");

        IQueryable<Ticket> query = _context.Tickets
            .AsNoTracking()
            .Include(t => t.Event)
            .Include(t => t.Seat)
            .Where(t => t.UserId == userId);

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<TicketStatus>(status, true, out var parsedStatus))
            query = query.Where(t => t.Status == parsedStatus);

        query = query.OrderByDescending(t => t.CreatedAt).ThenByDescending(t => t.Id);
        if (!string.IsNullOrWhiteSpace(cursor))
        {
            var decoded = DecodeCursor(cursor);
            query = query.Where(t => t.CreatedAt < decoded.CreatedAt || (t.CreatedAt == decoded.CreatedAt && t.Id.CompareTo(decoded.Id) < 0));
        }

        var rows = await query.Take(limit + 1).ToListAsync(cancellationToken);
        var hasMore = rows.Count > limit;
        if (hasMore) rows.RemoveAt(limit);
        var now = _time.UtcNow;
        var items = rows.Select(ticket => ToDto(ticket, now)).Where(ticket => ticket is not null).Cast<TicketDto>().ToList();
        var last = rows.LastOrDefault();
        var nextCursor = hasMore && last is not null ? EncodeCursor(last) : null;
        return new TicketCursorPage(items, nextCursor, hasMore);
    }

    private static TicketDto? ToDto(Ticket ticket, DateTime now)
    {
        if (ticket.Event == null || ticket.Seat == null) return null;
        var cutoffHours = ticket.Event.RefundCutoffHours > 0 ? ticket.Event.RefundCutoffHours : 24;
        var allowedUntil = ticket.Event.Date.AddHours(-cutoffHours);
        var canRefund = ticket.Status == TicketStatus.Paid && now <= allowedUntil;
        return new TicketDto(ticket.Id, ticket.EventId, ticket.SeatId, ticket.Event.Title, ticket.Event.Description,
            ticket.Event.Date, ticket.Event.EndDate, ticket.Event.Location, ticket.Event.VenueName, ticket.Event.Category,
            ticket.Event.ImageUrl, ticket.Seat.Row, ticket.Seat.Number, ticket.Seat.Tier, ticket.Price, ticket.Status.ToString(),
            ticket.OrderCode, ticket.QrCodeSignature, ticket.PaidAt, ticket.CheckedInAt, ticket.RefundAmount, ticket.RefundedAt,
            cutoffHours, canRefund);
    }

    private static string EncodeCursor(Ticket ticket)
    {
        var value = new TicketCursor(ticket.CreatedAt, ticket.Id);
        return Convert.ToBase64String(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(value)))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    private static TicketCursor DecodeCursor(string encoded)
    {
        try
        {
            var padded = encoded.Replace('-', '+').Replace('_', '/');
            padded += new string('=', (4 - padded.Length % 4) % 4);
            var cursor = JsonSerializer.Deserialize<TicketCursor>(Convert.FromBase64String(padded));
            if (cursor is null || cursor.Id == Guid.Empty) throw new ArgumentException("Cursor không hợp lệ.", nameof(encoded));
            return cursor;
        }
        catch (JsonException ex) { throw new ArgumentException("Cursor không hợp lệ.", nameof(encoded), ex); }
        catch (FormatException ex) { throw new ArgumentException("Cursor không hợp lệ.", nameof(encoded), ex); }
    }

    private sealed record TicketCursor(DateTime CreatedAt, Guid Id);
}

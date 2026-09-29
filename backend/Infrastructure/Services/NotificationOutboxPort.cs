using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;
using Microsoft.Data.Sqlite;
using TickeX.Application.Interfaces;
using TickeX.Domain.Entities;
namespace TickeX.Infrastructure.Services;
public sealed class NotificationOutboxPort : INotificationOutboxPort
{
    private readonly IApplicationDbContext _context;
    public NotificationOutboxPort(IApplicationDbContext context) => _context = context;
    public async Task<NotificationOutboxEnqueueResult> QueueTicketPaidAsync(Guid ticketId, Guid userId, Guid eventId, CancellationToken cancellationToken)
    {
        if (await _context.NotificationOutbox.AnyAsync(x => x.TicketId == ticketId, cancellationToken)) return NotificationOutboxEnqueueResult.AlreadyExists;
        _context.NotificationOutbox.Add(new NotificationOutboxItem(ticketId, userId, eventId));
        try { await _context.SaveChangesAsync(cancellationToken); return NotificationOutboxEnqueueResult.Created; }
        catch (DbUpdateException ex)
        {
            if (_context is DbContext context) context.ChangeTracker.Clear();
            if (IsUniqueViolation(ex)) return NotificationOutboxEnqueueResult.AlreadyExists;
            throw;
        }
    }

    private static bool IsUniqueViolation(DbUpdateException exception)
    {
        for (var current = exception.InnerException; current != null; current = current.InnerException)
        {
            if (current is SqlException sql && (sql.Number == 2601 || sql.Number == 2627))
                return true;
            if (current is SqliteException sqlite && sqlite.SqliteErrorCode == 19)
                return true;
        }

        var message = exception.InnerException?.Message ?? exception.Message;
        return message.Contains("UNIQUE", StringComparison.OrdinalIgnoreCase)
            || message.Contains("duplicate", StringComparison.OrdinalIgnoreCase)
            || message.Contains("IX_NotificationOutbox", StringComparison.OrdinalIgnoreCase);
    }
}

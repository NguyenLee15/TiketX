using Microsoft.EntityFrameworkCore;
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
        catch (DbUpdateException) { if (_context is DbContext context) context.ChangeTracker.Clear(); return NotificationOutboxEnqueueResult.AlreadyExists; }
    }
}

using Microsoft.EntityFrameworkCore;
using TickeX.Application.Interfaces;
using TickeX.Domain.Entities;

namespace TickeX.Infrastructure.Services;

public sealed class RefundRequestPort : IRefundRequestPort
{
    private readonly IApplicationDbContext _context;
    public RefundRequestPort(IApplicationDbContext context) => _context = context;

    public async Task<RefundEnqueueResult> EnqueueAsync(IReadOnlyCollection<RefundEnqueueItem> items, CancellationToken cancellationToken)
    {
        foreach (var item in items)
            _context.RefundRequests.Add(new RefundRequest(item.EventId, item.TicketId, item.Amount, item.IdempotencyKey));
        try
        {
            await _context.SaveChangesAsync(cancellationToken);
            return RefundEnqueueResult.Created;
        }
        catch (DbUpdateConcurrencyException)
        {
            ClearTracking();
            return RefundEnqueueResult.ConcurrencyConflict;
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            ClearTracking();
            var keys = items.Select(x => x.IdempotencyKey).ToArray();
            var count = await _context.RefundRequests.AsNoTracking()
                .CountAsync(x => keys.Contains(x.IdempotencyKey), cancellationToken);
            return count == keys.Length ? RefundEnqueueResult.AlreadyExists : RefundEnqueueResult.ConcurrencyConflict;
        }
    }

    private void ClearTracking()
    {
        if (_context is DbContext dbContext) dbContext.ChangeTracker.Clear();
    }

    private static bool IsUniqueViolation(DbUpdateException exception) => exception.InnerException switch
    {
        Microsoft.Data.Sqlite.SqliteException sqlite when sqlite.SqliteErrorCode == 19 => true,
        Microsoft.Data.SqlClient.SqlException sql when sql.Number is 2601 or 2627 => true,
        _ => false
    };
}

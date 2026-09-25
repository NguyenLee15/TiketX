using Microsoft.EntityFrameworkCore;
using TickeX.Domain.Entities;

namespace TickeX.Application.Interfaces;

public interface IApplicationDbContext
{
    DbSet<Event> Events { get; }
    DbSet<Seat> Seats { get; }
    DbSet<Ticket> Tickets { get; }
    DbSet<User> Users { get; }
    DbSet<PaymentTransaction> PaymentTransactions { get; }
    DbSet<EventStaffAssignment> EventStaffAssignments { get; }
    DbSet<AuditLog> AuditLogs { get; }
    DbSet<RefundRequest> RefundRequests { get; }
    DbSet<RefundBankAccount> RefundBankAccounts { get; }
    DbSet<RefreshToken> RefreshTokens { get; }
    DbSet<NotificationOutboxItem> NotificationOutbox { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken);
}

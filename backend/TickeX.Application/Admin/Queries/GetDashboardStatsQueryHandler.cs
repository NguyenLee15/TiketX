using MediatR;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Interfaces;
using TickeX.Domain.Enums;

namespace TickeX.Application.Admin.Queries;

public class GetDashboardStatsQueryHandler : IRequestHandler<GetDashboardStatsQuery, DashboardStatsResult>, IDashboardReadModel
{
    private readonly IApplicationDbContext _context;

    public GetDashboardStatsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<DashboardStatsResult> Handle(GetDashboardStatsQuery request, CancellationToken cancellationToken)
        => await GetAsync(cancellationToken);

    public async Task<DashboardStatsResult> GetAsync(CancellationToken cancellationToken)
    {
        var totalUsers = await _context.Users.CountAsync(cancellationToken);
        var totalEvents = await _context.Events
            .Where(e => !e.IsDeleted)
            .CountAsync(cancellationToken);

        var totalTicketsSold = await _context.Tickets
            .Where(t => t.Event != null && !t.Event.IsDeleted &&
                        (t.Status == TicketStatus.Paid || t.Status == TicketStatus.Used))
            .CountAsync(cancellationToken);

        // Gross revenue is the value of every ticket that reached a paid state,
        // including tickets now awaiting or completing a refund.
        var totalRevenue = (decimal)(await _context.Tickets
            .Where(t => t.Event != null && !t.Event.IsDeleted && t.PaidAt.HasValue &&
                        (t.Status == TicketStatus.Paid || t.Status == TicketStatus.Used ||
                         t.Status == TicketStatus.RefundPending || t.Status == TicketStatus.Cancelled))
            .SumAsync(t => (double?)t.Price, cancellationToken) ?? 0.0);

        var totalRefunded = (decimal)(await _context.Tickets
            .Where(t => t.Event != null && !t.Event.IsDeleted &&
                        t.Status == TicketStatus.Cancelled && t.RefundAmount.HasValue)
            .SumAsync(t => (double?)t.RefundAmount, cancellationToken) ?? 0.0);

        var totalRefundPending = (decimal)(await _context.Tickets
            .Where(t => t.Event != null && !t.Event.IsDeleted && t.Status == TicketStatus.RefundPending)
            .SumAsync(t => (double?)t.Price, cancellationToken) ?? 0.0);

        var totalCheckedIn = await _context.Tickets
            .Where(t => t.Event != null && !t.Event.IsDeleted && t.Status == TicketStatus.Used)
            .CountAsync(cancellationToken);

        // 1. Top 5 events by revenue computed via SQL GroupBy
        var topEventAggregates = await _context.Tickets
            .Where(t => t.Event != null && !t.Event.IsDeleted &&
                        (t.Status == TicketStatus.Paid || t.Status == TicketStatus.Used))
            .GroupBy(t => t.EventId)
            .Select(g => new
            {
                EventId = g.Key,
                TicketsSold = g.Count(),
                Revenue = g.Sum(t => (double)t.Price)
            })
            .OrderByDescending(x => x.Revenue)
            .Take(5)
            .ToListAsync(cancellationToken);

        var topEventIds = topEventAggregates.Select(x => x.EventId).ToList();

        var eventDetails = await _context.Events
            .Where(e => topEventIds.Contains(e.Id))
            .Select(e => new
            {
                e.Id,
                e.Title,
                e.Category,
                e.TotalSeats
            })
            .ToListAsync(cancellationToken);

        var topEvents = topEventAggregates.Select(tea =>
        {
            var ev = eventDetails.FirstOrDefault(e => e.Id == tea.EventId);
            return new TopEventStat(
                tea.EventId,
                ev?.Title ?? "N/A",
                ev?.Category ?? "N/A",
                tea.TicketsSold,
                (decimal)tea.Revenue,
                ev?.TotalSeats ?? 0
            );
        }).ToList();

        // 2. 7-day daily revenue & tickets stats (Zero-filled for missing days)
        var cutoffDate = DateTime.UtcNow.Date.AddDays(-6);
        var recentPaidTickets = await _context.Tickets
            .Where(t => t.Event != null && !t.Event.IsDeleted &&
                        (t.Status == TicketStatus.Paid || t.Status == TicketStatus.Used) &&
                        t.PaidAt.HasValue && t.PaidAt.Value >= cutoffDate)
            .Select(t => new
            {
                PaidDate = t.PaidAt!.Value.Date,
                t.Price
            })
            .ToListAsync(cancellationToken);

        var dailyGrouped = recentPaidTickets
            .GroupBy(x => x.PaidDate)
            .ToDictionary(
                g => g.Key,
                g => new { Revenue = g.Sum(x => x.Price), Count = g.Count() }
            );

        var dailyStats = new List<DailyRevenueStat>();
        for (int i = 0; i < 7; i++)
        {
            var currentDay = cutoffDate.AddDays(i);
            if (dailyGrouped.TryGetValue(currentDay, out var stat))
            {
                dailyStats.Add(new DailyRevenueStat(currentDay.ToString("yyyy-MM-dd"), stat.Revenue, stat.Count));
            }
            else
            {
                dailyStats.Add(new DailyRevenueStat(currentDay.ToString("yyyy-MM-dd"), 0m, 0));
            }
        }

        // 3. Recent 10 transactions with direct projection
        var recentTransactions = await _context.Tickets
            .Where(t => t.Event != null && !t.Event.IsDeleted &&
                        (t.Status == TicketStatus.Paid || t.Status == TicketStatus.Used ||
                         t.Status == TicketStatus.Cancelled || t.Status == TicketStatus.RefundPending))
            .OrderByDescending(t => t.CreatedAt)
            .Take(10)
            .Select(t => new RecentTransactionStat(
                t.Id,
                t.OrderCode,
                t.Event != null ? t.Event.Title : "N/A",
                t.User != null ? t.User.Name : "N/A",
                t.Price,
                t.Status.ToString(),
                t.CreatedAt
            ))
            .ToListAsync(cancellationToken);

        return new DashboardStatsResult(
            totalUsers,
            totalEvents,
            totalTicketsSold,
            totalRevenue,
            totalRefunded,
            totalCheckedIn,
            topEvents,
            recentTransactions,
            dailyStats,
            totalRefundPending,
            totalRevenue - totalRefunded - totalRefundPending
        );
    }
}

using Microsoft.EntityFrameworkCore;
using TickeX.Application.Admin.Queries;
using TickeX.Application.Interfaces;
using TickeX.Domain.Enums;

namespace TickeX.Infrastructure.Services;

/// <summary>
/// EF projection Adapter for the dashboard read Seam. Application does not
/// depend on DbSet details; this implementation owns query shape and filtering.
/// </summary>
public sealed class DashboardReadModelAdapter : IDashboardReadModel
{
    private readonly IApplicationDbContext _context;
    private readonly ITimePolicy _time;

    public DashboardReadModelAdapter(IApplicationDbContext context, ITimePolicy time)
    {
        _context = context;
        _time = time;
    }

    public async Task<DashboardStatsResult> GetAsync(CancellationToken cancellationToken)
    {
        var operationalTickets = _context.Tickets.Where(t => t.Event != null && !t.Event.IsDeleted);
        var totalUsers = await _context.Users.CountAsync(cancellationToken);
        var totalEvents = await _context.Events.CountAsync(e => !e.IsDeleted, cancellationToken);
        var paidStates = new[] { TicketStatus.Paid, TicketStatus.Used };

        var totalTicketsSold = await operationalTickets.CountAsync(t => paidStates.Contains(t.Status), cancellationToken);
        var totalRevenue = (await operationalTickets
            .Where(t => t.PaidAt.HasValue && (paidStates.Contains(t.Status) || t.Status == TicketStatus.RefundPending || t.Status == TicketStatus.Cancelled))
            .Select(t => t.Price)
            .ToListAsync(cancellationToken)).Sum();
        var totalRefunded = (await operationalTickets
            .Where(t => t.Status == TicketStatus.Cancelled && t.RefundAmount.HasValue)
            .Select(t => t.RefundAmount!.Value)
            .ToListAsync(cancellationToken)).Sum();
        var totalRefundPending = (await operationalTickets
            .Where(t => t.Status == TicketStatus.RefundPending)
            .Select(t => t.Price)
            .ToListAsync(cancellationToken)).Sum();
        var totalCheckedIn = await operationalTickets.CountAsync(t => t.Status == TicketStatus.Used, cancellationToken);

        var paidTickets = await operationalTickets
            .Where(t => paidStates.Contains(t.Status))
            .Select(t => new { t.EventId, t.Price })
            .ToListAsync(cancellationToken);

        var topAggregates = paidTickets
            .GroupBy(t => t.EventId)
            .Select(g => new { EventId = g.Key, TicketsSold = g.Count(), Revenue = g.Sum(t => t.Price) })
            .OrderByDescending(x => x.Revenue).Take(5).ToList();
        var eventIds = topAggregates.Select(x => x.EventId).ToList();
        var eventDetails = await _context.Events.Where(e => eventIds.Contains(e.Id))
            .Select(e => new { e.Id, e.Title, e.Category, e.TotalSeats }).ToListAsync(cancellationToken);
        var topEvents = topAggregates.Select(x =>
        {
            var ev = eventDetails.FirstOrDefault(e => e.Id == x.EventId);
            return new TopEventStat(x.EventId, ev?.Title ?? "N/A", ev?.Category ?? "N/A", x.TicketsSold, x.Revenue, ev?.TotalSeats ?? 0);
        }).ToList();

        var localToday = _time.LocalNow.Date;
        var cutoffLocal = localToday.AddDays(-6);
        var cutoffUtc = _time.ToUtc(cutoffLocal);
        var recentPaid = await operationalTickets
            .Where(t => paidStates.Contains(t.Status) && t.PaidAt.HasValue && t.PaidAt.Value >= cutoffUtc)
            .Select(t => new { PaidAt = t.PaidAt!.Value, t.Price }).ToListAsync(cancellationToken);
        var grouped = recentPaid.GroupBy(x => _time.ToLocal(x.PaidAt).Date)
            .ToDictionary(g => g.Key, g => new { Revenue = g.Sum(x => x.Price), Count = g.Count() });
        var dailyStats = Enumerable.Range(0, 7).Select(i =>
        {
            var date = cutoffLocal.AddDays(i);
            return grouped.TryGetValue(date, out var value)
                ? new DailyRevenueStat(date.ToString("yyyy-MM-dd"), value.Revenue, value.Count)
                : new DailyRevenueStat(date.ToString("yyyy-MM-dd"), 0m, 0);
        }).ToList();

        var recentTransactions = await operationalTickets
            .Where(t => paidStates.Contains(t.Status) || t.Status == TicketStatus.Cancelled || t.Status == TicketStatus.RefundPending)
            .OrderByDescending(t => t.CreatedAt).Take(10)
            .Select(t => new RecentTransactionStat(t.Id, t.OrderCode, t.Event!.Title, t.User != null ? t.User.Name : "N/A", t.Price, t.Status.ToString(), t.CreatedAt))
            .ToListAsync(cancellationToken);

        return new DashboardStatsResult(totalUsers, totalEvents, totalTicketsSold, totalRevenue, totalRefunded,
            totalCheckedIn, topEvents, recentTransactions, dailyStats, totalRefundPending,
            totalRevenue - totalRefunded - totalRefundPending);
    }
}

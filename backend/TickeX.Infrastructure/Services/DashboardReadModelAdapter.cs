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
        var totalRevenue = await SumAmountAsync(
            operationalTickets
                .Where(t => t.PaidAt.HasValue && (paidStates.Contains(t.Status) || t.Status == TicketStatus.RefundPending || t.Status == TicketStatus.Cancelled))
                .Select(t => (decimal?)t.Price),
            cancellationToken);
        var totalRefunded = await SumAmountAsync(
            operationalTickets
                .Where(t => t.Status == TicketStatus.Cancelled && t.RefundAmount.HasValue)
                .Select(t => t.RefundAmount),
            cancellationToken);
        var pendingRefundAmounts = _context.RefundRequests
            .Where(refund => refund.Status != "Completed"
                && operationalTickets.Any(ticket => ticket.Id == refund.TicketId))
            .Select(refund => (decimal?)refund.Amount);
        var totalRefundPending = await SumAmountAsync(pendingRefundAmounts, cancellationToken);
        var totalCheckedIn = await operationalTickets.CountAsync(t => t.Status == TicketStatus.Used, cancellationToken);

        var isSqlite = (_context as DbContext)?.Database.ProviderName?.Contains("Sqlite", StringComparison.OrdinalIgnoreCase) == true;
        List<TopEventAggregate> topAggregates;

        if (isSqlite)
        {
            var paidTickets = await operationalTickets
                .Where(t => paidStates.Contains(t.Status))
                .Select(t => new { t.EventId, t.Price })
                .ToListAsync(cancellationToken);

            topAggregates = paidTickets
                .GroupBy(t => t.EventId)
                .Select(g => new TopEventAggregate(g.Key, g.Count(), g.Sum(t => t.Price)))
                .OrderByDescending(x => x.Revenue)
                .ThenBy(x => x.EventId)
                .Take(5)
                .ToList();
        }
        else
        {
            topAggregates = await operationalTickets
                .Where(t => paidStates.Contains(t.Status))
                .GroupBy(t => t.EventId)
                .Select(g => new TopEventAggregate(g.Key, g.Count(), g.Sum(t => t.Price)))
                .OrderByDescending(x => x.Revenue)
                .ThenBy(x => x.EventId)
                .Take(5)
                .ToListAsync(cancellationToken);
        }
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
        var dayStartsUtc = Enumerable.Range(0, 8)
            .Select(i => _time.ToUtc(cutoffLocal.AddDays(i)))
            .ToArray();
        Dictionary<int, (decimal Revenue, int Count)> dailyAggregates;
        if (isSqlite)
        {
            var recentPaid = await operationalTickets
                .Where(t => paidStates.Contains(t.Status) && t.PaidAt.HasValue
                    && t.PaidAt.Value >= dayStartsUtc[0] && t.PaidAt.Value < dayStartsUtc[7])
                .Select(t => new { PaidAt = t.PaidAt!.Value, t.Price }).ToListAsync(cancellationToken);
            dailyAggregates = recentPaid
                .GroupBy(t => Enumerable.Range(0, 7).First(i => t.PaidAt >= dayStartsUtc[i] && t.PaidAt < dayStartsUtc[i + 1]))
                .ToDictionary(g => g.Key, g => (g.Sum(t => t.Price), g.Count()));
        }
        else
        {
            var day1StartUtc = dayStartsUtc[1];
            var day2StartUtc = dayStartsUtc[2];
            var day3StartUtc = dayStartsUtc[3];
            var day4StartUtc = dayStartsUtc[4];
            var day5StartUtc = dayStartsUtc[5];
            var day6StartUtc = dayStartsUtc[6];
            var groupedDailyStats = await operationalTickets
                .Where(t => paidStates.Contains(t.Status) && t.PaidAt.HasValue
                    && t.PaidAt.Value >= dayStartsUtc[0] && t.PaidAt.Value < dayStartsUtc[7])
                .GroupBy(t => t.PaidAt!.Value < day1StartUtc ? 0
                    : t.PaidAt.Value < day2StartUtc ? 1
                    : t.PaidAt.Value < day3StartUtc ? 2
                    : t.PaidAt.Value < day4StartUtc ? 3
                    : t.PaidAt.Value < day5StartUtc ? 4
                    : t.PaidAt.Value < day6StartUtc ? 5
                    : 6)
                .Select(g => new { DayIndex = g.Key, Revenue = g.Sum(t => t.Price), Count = g.Count() })
                .ToListAsync(cancellationToken);
            dailyAggregates = groupedDailyStats.ToDictionary(g => g.DayIndex, g => (g.Revenue, g.Count));
        }

        var dailyStats = Enumerable.Range(0, 7).Select(i =>
        {
            var date = cutoffLocal.AddDays(i);
            return dailyAggregates.TryGetValue(i, out var value)
                ? new DailyRevenueStat(date.ToString("yyyy-MM-dd"), value.Revenue, value.Count)
                : new DailyRevenueStat(date.ToString("yyyy-MM-dd"), 0m, 0);
        }).ToList();

        var recentTransactions = await operationalTickets
            .Where(t => paidStates.Contains(t.Status) || t.Status == TicketStatus.Cancelled || t.Status == TicketStatus.RefundPending)
            .OrderByDescending(t => t.CreatedAt)
            .ThenByDescending(t => t.Id)
            .Take(10)
            .Select(t => new RecentTransactionStat(t.Id, t.OrderCode, t.Event!.Title, t.User != null ? t.User.Name : "N/A", t.Price, t.Status.ToString(), t.CreatedAt))
            .ToListAsync(cancellationToken);

        return new DashboardStatsResult(totalUsers, totalEvents, totalTicketsSold, totalRevenue, totalRefunded,
            totalCheckedIn, topEvents, recentTransactions, dailyStats, totalRefundPending,
            totalRevenue - totalRefunded - totalRefundPending);
    }

    private async Task<decimal> SumAmountAsync(IQueryable<decimal?> query, CancellationToken cancellationToken)
    {
        var isSqlite = (_context as DbContext)?.Database.ProviderName?.Contains("Sqlite", StringComparison.OrdinalIgnoreCase) == true;
        if (isSqlite)
        {
            var list = await query.Where(p => p.HasValue).Select(p => p!.Value).ToListAsync(cancellationToken);
            return list.Sum();
        }

        return await query.SumAsync(cancellationToken) ?? 0m;
    }

    private sealed record TopEventAggregate(Guid EventId, int TicketsSold, decimal Revenue);
}

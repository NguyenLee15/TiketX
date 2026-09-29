using MediatR;

namespace TickeX.Application.Admin.Queries;

public record DailyRevenueStat(
    string Date,
    decimal Revenue,
    int TicketsSold
);

public record TopEventStat(
    Guid Id, 
    string Title, 
    string Category, 
    int TicketsSold, 
    decimal Revenue, 
    int TotalSeats
);

public record RecentTransactionStat(
    Guid TicketId,
    long OrderCode,
    string EventTitle,
    string UserName,
    decimal Amount,
    string Status,
    DateTime CreatedAt
);

public record DashboardStatsResult(
    int TotalUsers, 
    int TotalEvents, 
    int TotalTicketsSold,
    decimal TotalRevenue, 
    decimal TotalRefunded,
    int TotalCheckedIn,
    List<TopEventStat> TopEvents,
    List<RecentTransactionStat> RecentTransactions,
    List<DailyRevenueStat> DailyStats,
    decimal TotalRefundPending = 0m,
    decimal TotalNetRevenue = 0m
);

public record GetDashboardStatsQuery : IRequest<DashboardStatsResult>;

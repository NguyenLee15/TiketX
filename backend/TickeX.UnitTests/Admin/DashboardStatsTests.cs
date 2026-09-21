using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Admin.Queries;
using TickeX.Domain.Entities;
using TickeX.Domain.Enums;
using TickeX.Infrastructure.Persistence;
using TickeX.Infrastructure.Services;
using Xunit;

namespace TickeX.UnitTests.Admin;

public class DashboardStatsTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly ApplicationDbContext _context;

    public DashboardStatsTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite(_connection)
            .Options;

        _context = new ApplicationDbContext(options);
        _context.Database.EnsureCreated();
    }

    public void Dispose()
    {
        _context.Dispose();
        _connection.Dispose();
    }

    [Fact]
    public async Task GetDashboardStats_ShouldReturnAggregatedDataAndZeroFilled7DayStats()
    {
        // Arrange
        var user = new User("Alice", "alice@example.com", "hash", "Customer");
        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        var ev1 = new Event("Rock Fest", "Desc", DateTime.UtcNow.AddDays(1), DateTime.UtcNow.AddDays(1).AddHours(3), "Loc", "Venue", 100, "Concert", basePrice: 100000m);
        ev1.GenerateSeatsMatrix(1, 2);
        _context.Events.Add(ev1);

        var ev2 = new Event("Jazz Night", "Desc", DateTime.UtcNow.AddDays(2), DateTime.UtcNow.AddDays(2).AddHours(3), "Loc", "Venue", 50, "Music", basePrice: 200000m);
        ev2.GenerateSeatsMatrix(1, 2);
        _context.Events.Add(ev2);
        await _context.SaveChangesAsync();

        // ev1: 1 Paid ticket today
        var t1 = new Ticket(ev1.Id, ev1.Seats.First().Id, user.Id, 100000m);
        t1.MarkAsPaid();
        _context.Tickets.Add(t1);

        // ev2: 1 Used ticket today
        var t2 = new Ticket(ev2.Id, ev2.Seats.First().Id, user.Id, 200000m);
        t2.MarkAsPaid();
        t2.CheckIn();
        _context.Tickets.Add(t2);

        // ev1: 1 Refunded ticket
        var t3 = new Ticket(ev1.Id, ev1.Seats.Last().Id, user.Id, 100000m);
        t3.MarkAsPaid();
        t3.Refund(80000m);
        _context.Tickets.Add(t3);

        await _context.SaveChangesAsync();

        var readModel = new DashboardReadModelAdapter(_context, new VietnamTimePolicy());

        // Act
        var result = await readModel.GetAsync(CancellationToken.None);

        // Assert
        result.TotalUsers.Should().Be(1);
        result.TotalEvents.Should().Be(2);
        result.TotalTicketsSold.Should().Be(2); // t1 (Paid) and t2 (Used)
        result.TotalRevenue.Should().Be(400000m); // gross includes the paid ticket later refunded
        result.TotalRefunded.Should().Be(80000m);
        result.TotalRefundPending.Should().Be(0m);
        result.TotalNetRevenue.Should().Be(320000m);
        result.TotalCheckedIn.Should().Be(1);

        // Top Events: ev2 revenue (200,000) > ev1 revenue (100,000)
        result.TopEvents.Should().HaveCount(2);
        result.TopEvents[0].Title.Should().Be("Jazz Night");
        result.TopEvents[0].Revenue.Should().Be(200000m);
        result.TopEvents[1].Title.Should().Be("Rock Fest");
        result.TopEvents[1].Revenue.Should().Be(100000m);

        // Daily Stats: exactly 7 days
        result.DailyStats.Should().HaveCount(7);
        var todayStr = new VietnamTimePolicy().ToLocal(DateTime.UtcNow).Date.ToString("yyyy-MM-dd");
        var todayStat = result.DailyStats.FirstOrDefault(s => s.Date == todayStr);
        todayStat.Should().NotBeNull();
        todayStat!.Revenue.Should().Be(300000m);
        todayStat.TicketsSold.Should().Be(2);

        // Older days should be zero-filled
        var zeroDays = result.DailyStats.Where(s => s.Date != todayStr).ToList();
        zeroDays.Should().HaveCount(6);
        zeroDays.Should().OnlyContain(s => s.Revenue == 0m && s.TicketsSold == 0);
    }

    [Fact]
    public async Task GetDashboardStats_WhenDatabaseHasNoTickets_ReturnsZeroWithoutNullPointer()
    {
        var readModel = new DashboardReadModelAdapter(_context, new VietnamTimePolicy());

        var result = await readModel.GetAsync(CancellationToken.None);

        result.TotalUsers.Should().Be(0);
        result.TotalEvents.Should().Be(0);
        result.TotalTicketsSold.Should().Be(0);
        result.TotalRevenue.Should().Be(0m);
        result.TotalRefunded.Should().Be(0m);
        result.TotalRefundPending.Should().Be(0m);
        result.TotalNetRevenue.Should().Be(0m);
        result.TotalCheckedIn.Should().Be(0);
        result.TopEvents.Should().BeEmpty();
        result.DailyStats.Should().HaveCount(7);
        result.RecentTransactions.Should().BeEmpty();
    }
}

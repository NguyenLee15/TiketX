using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Events.Commands;
using TickeX.Application.Events.Queries;
using TickeX.Domain.Entities;
using TickeX.Domain.Enums;
using TickeX.Infrastructure.Persistence;
using TickeX.Infrastructure.Services;
using Xunit;

namespace TickeX.UnitTests.Admin;

public class EventLifecycleAndDeletionTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly ApplicationDbContext _context;

    public EventLifecycleAndDeletionTests()
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
    public void GenerateSeatsMatrix_ShouldSupportMoreThan8Rows()
    {
        // Arrange
        var ev = new Event("Mega Fest", "Desc", DateTime.UtcNow, DateTime.UtcNow.AddHours(4), "Loc", "Venue", 300, basePrice: 100000m);

        // Act: generate 10 rows (A to J)
        ev.GenerateSeatsMatrix(rowCount: 10, seatsPerRow: 10);

        // Assert
        ev.TotalSeats.Should().Be(100);
        ev.Seats.Should().HaveCount(100);

        var distinctRows = ev.Seats.Select(s => s.Row).Distinct().ToList();
        distinctRows.Should().HaveCount(10);
        distinctRows.Should().Contain(new[] { "A", "B", "C", "D", "E", "F", "G", "H", "I", "J" });
    }

    [Fact]
    public void GenerateSeatsMatrix_ShouldSupportMoreThan26Rows_WithExcelStyleLetters()
    {
        // Arrange
        var ev = new Event("Super Stadium", "Desc", DateTime.UtcNow, DateTime.UtcNow.AddHours(4), "Loc", "Venue", 1000, basePrice: 100000m);

        // Act: generate 28 rows (A..Z, AA, AB)
        ev.GenerateSeatsMatrix(rowCount: 28, seatsPerRow: 2);

        // Assert
        var distinctRows = ev.Seats.Select(s => s.Row).Distinct().ToList();
        distinctRows.Should().Contain("Z");
        distinctRows.Should().Contain("AA");
        distinctRows.Should().Contain("AB");
    }

    [Fact]
    public async Task DeleteEvent_WhenEventHasPaidTickets_ShouldRefuseWithBadRequest()
    {
        // Arrange
        var user = new User("Bob", "bob@example.com", "hash", "Customer");
        _context.Users.Add(user);
        var ev = new Event("Show 1", "Desc", DateTime.UtcNow.AddDays(2), DateTime.UtcNow.AddDays(2).AddHours(3), "Loc", "Venue", 50, basePrice: 150000m);
        ev.GenerateSeatsMatrix(1, 2);
        _context.Events.Add(ev);
        await _context.SaveChangesAsync();

        var ticket = new Ticket(ev.Id, ev.Seats.First().Id, user.Id, 150000m);
        ticket.MarkAsPaid();
        _context.Tickets.Add(ticket);
        await _context.SaveChangesAsync();

        var handler = new DeleteEventCommandHandler(_context);

        // Act
        var result = await handler.Handle(new DeleteEventCommand(ev.Id), CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(400);
        result.ErrorCode.Should().Be("EVENT_HAS_ASSOCIATED_TICKETS");
        result.Message.Should().Contain("Sự kiện đã phát sinh vé và chứng từ giao dịch");

        // Event must still exist
        var eventInDb = await _context.Events.IgnoreQueryFilters().FirstOrDefaultAsync(e => e.Id == ev.Id);
        eventInDb.Should().NotBeNull();
        eventInDb!.IsDeleted.Should().BeFalse();
    }

    [Fact]
    public async Task DeleteEvent_WhenEventHasCancelledTickets_ShouldRefuseWithBadRequest()
    {
        // Arrange: financial history must be preserved even if tickets are Cancelled/Refunded
        var user = new User("Bob", "bob@example.com", "hash", "Customer");
        _context.Users.Add(user);
        var ev = new Event("Show 2", "Desc", DateTime.UtcNow.AddDays(2), DateTime.UtcNow.AddDays(2).AddHours(3), "Loc", "Venue", 50, basePrice: 150000m);
        ev.GenerateSeatsMatrix(1, 2);
        _context.Events.Add(ev);
        await _context.SaveChangesAsync();

        var ticket = new Ticket(ev.Id, ev.Seats.First().Id, user.Id, 150000m);
        ticket.Cancel();
        _context.Tickets.Add(ticket);
        await _context.SaveChangesAsync();

        var handler = new DeleteEventCommandHandler(_context);

        // Act
        var result = await handler.Handle(new DeleteEventCommand(ev.Id), CancellationToken.None);

        // Assert: still refused because tickets exist
        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(400);
        result.ErrorCode.Should().Be("EVENT_HAS_ASSOCIATED_TICKETS");
    }

    [Fact]
    public async Task DeleteEvent_WhenEventHasZeroTickets_ShouldSoftDelete()
    {
        // Arrange: No tickets have been created
        var ev = new Event("Empty Show", "Desc", DateTime.UtcNow.AddDays(2), DateTime.UtcNow.AddDays(2).AddHours(3), "Loc", "Venue", 50, basePrice: 150000m);
        ev.GenerateSeatsMatrix(1, 2);
        _context.Events.Add(ev);
        await _context.SaveChangesAsync();

        var handler = new DeleteEventCommandHandler(_context);

        // Act
        var result = await handler.Handle(new DeleteEventCommand(ev.Id), CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.StatusCode.Should().Be(200);

        // Event should be soft-deleted in DB
        var eventInDb = await _context.Events.IgnoreQueryFilters().FirstOrDefaultAsync(e => e.Id == ev.Id);
        eventInDb.Should().NotBeNull();
        eventInDb!.IsDeleted.Should().BeTrue();

        // Standard query should NOT return soft-deleted event due to Global Query Filter
        var visibleEvent = await _context.Events.FirstOrDefaultAsync(e => e.Id == ev.Id);
        visibleEvent.Should().BeNull();
    }

    [Fact]
    public async Task CancelEvent_ShouldMarkPaidTicketsPendingRefund_WithoutReleasingSoldSeats()
    {
        // Arrange
        var user = new User("Charlie", "charlie@example.com", "hash", "Customer");
        _context.Users.Add(user);

        var ev = new Event("Concert to Cancel", "Desc", DateTime.UtcNow.AddDays(5), DateTime.UtcNow.AddDays(5).AddHours(3), "Loc", "Venue", 50, basePrice: 200000m);
        ev.GenerateSeatsMatrix(1, 2);
        _context.Events.Add(ev);
        await _context.SaveChangesAsync();

        var seat1 = ev.Seats.First();
        var seat2 = ev.Seats.Last();

        seat1.Lock(user.Id);
        seat1.MarkAsSold();
        var paidTicket = new Ticket(ev.Id, seat1.Id, user.Id, 200000m);
        paidTicket.MarkAsPaid();
        _context.Tickets.Add(paidTicket);

        seat2.Lock(user.Id);
        var pendingTicket = new Ticket(ev.Id, seat2.Id, user.Id, 200000m);
        _context.Tickets.Add(pendingTicket);

        await _context.SaveChangesAsync();

        var handler = new CancelEventCommandHandler(_context, new RefundRequestPort(_context));
        var command = new CancelEventCommand(ev.Id, "Typhoon Weather Warning", AdminEmail: "superadmin@tickex.com");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.StatusCode.Should().Be(200);

        // Event status is Cancelled
        var updatedEv = await _context.Events.IgnoreQueryFilters().FirstAsync(e => e.Id == ev.Id);
        updatedEv.Status.Should().Be(EventStatus.Cancelled);

        // Paid ticket awaits provider confirmation
        var updatedPaidTicket = await _context.Tickets.FirstAsync(t => t.Id == paidTicket.Id);
        updatedPaidTicket.Status.Should().Be(TicketStatus.RefundPending);
        updatedPaidTicket.RefundAmount.Should().BeNull();

        var refundRequest = await _context.RefundRequests.SingleAsync(x => x.TicketId == paidTicket.Id);
        refundRequest.Status.Should().Be("Pending");
        refundRequest.Amount.Should().Be(200000m);
        refundRequest.IdempotencyKey.Should().Contain(paidTicket.Id.ToString("N"));

        // Pending ticket is cancelled
        var updatedPendingTicket = await _context.Tickets.FirstAsync(t => t.Id == pendingTicket.Id);
        updatedPendingTicket.Status.Should().Be(TicketStatus.Cancelled);

        // Sold seat remains reserved until provider confirms refund
        var updatedSeat1 = await _context.Seats.FirstAsync(s => s.Id == seat1.Id);
        updatedSeat1.Status.Should().Be(SeatStatus.Sold);
        var updatedSeat2 = await _context.Seats.FirstAsync(s => s.Id == seat2.Id);
        updatedSeat2.Status.Should().Be(SeatStatus.Available);

        // Audit log exists
        var audit = await _context.AuditLogs.FirstOrDefaultAsync(al => al.Action == "CANCEL_EVENT" && al.EntityId == ev.Id.ToString());
        audit.Should().NotBeNull();
        audit!.AfterState.Should().Contain("Typhoon Weather Warning");
    }

    [Fact]
    public async Task UpdateEvent_WhenTicketsSold_ShouldForbidChangingSeatsOrPrice()
    {
        // Arrange
        var user = new User("David", "david@example.com", "hash", "Customer");
        _context.Users.Add(user);

        var ev = new Event("Selling Show", "Desc", DateTime.UtcNow.AddDays(3), DateTime.UtcNow.AddDays(3).AddHours(3), "Loc", "Venue", 100, basePrice: 200000m);
        ev.GenerateSeatsMatrix(1, 2);
        _context.Events.Add(ev);
        await _context.SaveChangesAsync();

        var ticket = new Ticket(ev.Id, ev.Seats.First().Id, user.Id, 200000m);
        ticket.MarkAsPaid();
        _context.Tickets.Add(ticket);
        await _context.SaveChangesAsync();

        var handler = new UpdateEventCommandHandler(_context);

        // Act 1: Try to change TotalSeats
        var cmd1 = new UpdateEventCommand(
            ev.Id, ev.Title, ev.Description, ev.Date, ev.EndDate, ev.Location, ev.VenueName,
            TotalSeats: 200, // modified
            Category: ev.Category, ImageUrl: ev.ImageUrl, BasePrice: ev.BasePrice
        );
        var res1 = await handler.Handle(cmd1, CancellationToken.None);

        // Assert 1
        res1.Success.Should().BeFalse();
        res1.StatusCode.Should().Be(400);
        res1.ErrorCode.Should().Be("CANNOT_MODIFY_SEATS_AFTER_SALES");

        // Act 2: Try to change BasePrice
        var cmd2 = new UpdateEventCommand(
            ev.Id, ev.Title, ev.Description, ev.Date, ev.EndDate, ev.Location, ev.VenueName,
            TotalSeats: ev.TotalSeats,
            Category: ev.Category, ImageUrl: ev.ImageUrl, 
            BasePrice: 350000m // modified
        );
        var res2 = await handler.Handle(cmd2, CancellationToken.None);

        // Assert 2
        res2.Success.Should().BeFalse();
        res2.StatusCode.Should().Be(400);
        res2.ErrorCode.Should().Be("CANNOT_MODIFY_PRICE_AFTER_SALES");
    }

    [Fact]
    public async Task UpdateEvent_WhenPendingReservationExists_ShouldForbidChangingSchedule()
    {
        var user = new User("Pending", "pending@example.com", "hash", "Customer");
        _context.Users.Add(user);
        var ev = new Event("Held Show", "Desc", DateTime.UtcNow.AddDays(3), DateTime.UtcNow.AddDays(3).AddHours(3), "Loc", "Venue", 2, basePrice: 200000m);
        ev.GenerateSeatsMatrix(1, 2);
        _context.Events.Add(ev);
        await _context.SaveChangesAsync();

        _context.Tickets.Add(new Ticket(ev.Id, ev.Seats.First().Id, user.Id, 200000m));
        await _context.SaveChangesAsync();

        var result = await new UpdateEventCommandHandler(_context).Handle(new UpdateEventCommand(
            ev.Id, ev.Title, ev.Description, ev.Date.AddHours(1), ev.EndDate.AddHours(1), ev.Location, ev.VenueName,
            ev.TotalSeats, ev.Category, ev.ImageUrl, BasePrice: ev.BasePrice), CancellationToken.None);

        result.Success.Should().BeFalse();
        result.ErrorCode.Should().Be("CANNOT_MODIFY_DATE_AFTER_SALES");
    }
}

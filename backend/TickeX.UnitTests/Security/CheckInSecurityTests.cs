using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using TickeX.Application.Interfaces;
using TickeX.Application.Tickets.Commands;
using TickeX.Domain.Entities;
using TickeX.Domain.Enums;
using TickeX.Infrastructure.Persistence;
using TickeX.Infrastructure.Services;
using Xunit;

namespace TickeX.UnitTests.Security;

public class CheckInSecurityTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly ApplicationDbContext _context;
    private readonly ITicketSecurityService _ticketSecurityService;

    public CheckInSecurityTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite(_connection)
            .Options;

        _context = new ApplicationDbContext(options);
        _context.Database.EnsureCreated();

        var settings = new Dictionary<string, string?>
        {
            { "TicketSecurity:SecretKeys:k1", "SuperSecretKeyForCheckInTesting1234567890!" },
            { "TicketSecurity:CurrentKeyId", "k1" }
        };
        IConfiguration config = new ConfigurationBuilder()
            .AddInMemoryCollection(settings)
            .Build();

        _ticketSecurityService = new TicketSecurityService(config);
    }

    public void Dispose()
    {
        _context.Dispose();
        _connection.Dispose();
    }

    private async Task<(Event ev, Seat seat, User user, Ticket ticket)> SeedTicketAsync(
        TicketStatus status = TicketStatus.Paid,
        DateTime? eventDate = null,
        DateTime? eventEndDate = null)
    {
        var ev = new Event(
            "Live Concert 2026",
            "Great concert",
            eventDate ?? DateTime.UtcNow.AddMinutes(-30),
            eventEndDate ?? DateTime.UtcNow.AddHours(2),
            "Hanoi Stadium",
            "Stadium A",
            100,
            "Concert",
            basePrice: 500000m
        );
        ev.GenerateSeatsMatrix(1, 1);
        _context.Events.Add(ev);
        await _context.SaveChangesAsync();

        var seat = ev.Seats.First();

        var user = new User("John Doe", "john@example.com", "hash", "Customer");
        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        var ticket = new Ticket(ev.Id, seat.Id, user.Id, 500000m);
        if (status == TicketStatus.Paid)
        {
            ticket.MarkAsPaid();
        }
        else if (status == TicketStatus.Used)
        {
            ticket.MarkAsPaid();
            ticket.CheckIn();
        }
        _context.Tickets.Add(ticket);
        await _context.SaveChangesAsync();

        return (ev, seat, user, ticket);
    }

    [Fact]
    public async Task CheckIn_WithRawGuid_ShouldFailWithBadRequest()
    {
        // Arrange: Try to bypass check-in by passing a raw Guid string
        var (_, _, _, ticket) = await SeedTicketAsync();
        var handler = new CheckInTicketCommandHandler(_context, _ticketSecurityService);
        var command = new CheckInTicketCommand(
            ticket.Id.ToString(), 
            Guid.NewGuid(), 
            StaffRole: "Admin"
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert: Raw Guid bypass is eliminated; must fail HMAC validation
        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(400);
        result.Message.Should().Contain("Định dạng mã QR không hợp lệ");
    }

    [Fact]
    public async Task CheckIn_WithTamperedPayload_MismatchedEventId_ShouldFailWithBadRequest()
    {
        // Arrange: Generate valid HMAC token but with mismatched EventId
        var (ev, _, _, ticket) = await SeedTicketAsync();
        var differentEventId = Guid.NewGuid();

        var tamperedToken = _ticketSecurityService.GenerateSignedQrToken(
            ticket.Id, 
            differentEventId, 
            ticket.OrderCode, 
            DateTime.UtcNow.AddHours(5)
        );

        var handler = new CheckInTicketCommandHandler(_context, _ticketSecurityService);
        var command = new CheckInTicketCommand(tamperedToken, Guid.NewGuid(), StaffRole: "Admin");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(400);
        result.Message.Should().Contain("Thông tin mã vé không khớp với sự kiện");
    }

    [Fact]
    public async Task CheckIn_WhenTicketAlreadyUsed_ShouldReturn409Conflict()
    {
        // Arrange: Ticket is already Used
        var (ev, _, _, ticket) = await SeedTicketAsync(status: TicketStatus.Used);
        var validToken = _ticketSecurityService.GenerateSignedQrToken(
            ticket.Id, 
            ev.Id, 
            ticket.OrderCode, 
            DateTime.UtcNow.AddHours(5)
        );

        var handler = new CheckInTicketCommandHandler(_context, _ticketSecurityService);
        var command = new CheckInTicketCommand(validToken, Guid.NewGuid(), StaffRole: "Admin");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(409);
        result.Message.Should().Contain("VÉ ĐÃ ĐƯỢC CHECK-IN TRƯỚC ĐÓ");
    }

    [Fact]
    public async Task CheckIn_WhenStaffNotAssignedToEvent_ShouldReturn403Forbidden()
    {
        // Arrange: Staff role, not assigned in EventStaffAssignments
        var (ev, _, _, ticket) = await SeedTicketAsync();
        var unassignedStaffId = Guid.NewGuid();

        var validToken = _ticketSecurityService.GenerateSignedQrToken(
            ticket.Id, 
            ev.Id, 
            ticket.OrderCode, 
            DateTime.UtcNow.AddHours(5)
        );

        var handler = new CheckInTicketCommandHandler(_context, _ticketSecurityService);
        var command = new CheckInTicketCommand(
            validToken, 
            unassignedStaffId, 
            StaffRole: "Staff"
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(403);
        result.Message.Should().Contain("Bạn không được phân công phụ trách soát vé");
    }

    [Fact]
    public async Task CheckIn_WhenAdminOrAssignedStaff_ShouldSucceedAndRecordAuditLog()
    {
        // Arrange
        var (ev, _, _, ticket) = await SeedTicketAsync();
        var staffUser = new User("Staff Alice", "staff1@tickex.com", "hash", "Staff");
        _context.Users.Add(staffUser);
        await _context.SaveChangesAsync();

        var staffId = staffUser.Id;

        // Assign staff to event
        _context.EventStaffAssignments.Add(new EventStaffAssignment(ev.Id, staffId));
        await _context.SaveChangesAsync();

        var validToken = _ticketSecurityService.GenerateSignedQrToken(
            ticket.Id, 
            ev.Id, 
            ticket.OrderCode, 
            DateTime.UtcNow.AddHours(5)
        );

        var handler = new CheckInTicketCommandHandler(_context, _ticketSecurityService);
        var command = new CheckInTicketCommand(
            validToken, 
            staffId, 
            StaffRole: "Staff",
            StaffEmail: "staff1@tickex.com",
            IpAddress: "192.168.1.50"
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.StatusCode.Should().Be(200);
        result.Message.Should().Contain("CHECK-IN THÀNH CÔNG");

        // Verify ticket in DB
        var updatedTicket = await _context.Tickets.FirstAsync(t => t.Id == ticket.Id);
        updatedTicket.Status.Should().Be(TicketStatus.Used);
        updatedTicket.CheckedInByStaffId.Should().Be(staffId);
        updatedTicket.CheckedInAt.Should().NotBeNull();

        // Verify AuditLog written
        var audit = await _context.AuditLogs.FirstOrDefaultAsync(al => al.EntityId == ticket.Id.ToString());
        audit.Should().NotBeNull();
        audit!.Action.Should().Be("CHECK_IN");
        audit.UserId.Should().Be(staffId);
        audit.UserEmail.Should().Be("staff1@tickex.com");
        audit.IpAddress.Should().Be("192.168.1.50");
        audit.AfterState.Should().Contain("[REDACTED]");
    }

    [Fact]
    public async Task CheckIn_BeforeGateOpeningTime_ShouldReturn400BadRequest()
    {
        // Arrange: Event starts in 5 hours (gate opens 2 hours before, so 3 hours from now)
        var futureDate = DateTime.UtcNow.AddHours(5);
        var futureEndDate = DateTime.UtcNow.AddHours(8);
        var (ev, _, _, ticket) = await SeedTicketAsync(
            status: TicketStatus.Paid, 
            eventDate: futureDate, 
            eventEndDate: futureEndDate
        );

        var validToken = _ticketSecurityService.GenerateSignedQrToken(
            ticket.Id, 
            ev.Id, 
            ticket.OrderCode, 
            futureEndDate
        );

        var handler = new CheckInTicketCommandHandler(_context, _ticketSecurityService);
        var command = new CheckInTicketCommand(validToken, Guid.NewGuid(), StaffRole: "Admin");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(400);
        result.Message.Should().Contain("Chưa đến thời gian mở cổng soát vé");
    }

    [Fact]
    public async Task CheckIn_WhenQrSignatureDoesNotMatchStoredSignature_ShouldFailWithSignatureMismatch()
    {
        // Arrange: Ticket has an active signature stored, but an older/re-issued QR token is presented
        var (ev, _, _, ticket) = await SeedTicketAsync(status: TicketStatus.Paid);
        var oldToken = _ticketSecurityService.GenerateSignedQrToken(
            ticket.Id,
            ev.Id,
            ticket.OrderCode,
            DateTime.UtcNow.AddHours(2)
        );
        // Stored signature in DB is different (representing a re-issued ticket QR)
        ticket.SetQrSignature("NEW_REISSUED_TOKEN_SIGNATURE_ABCD1234");
        await _context.SaveChangesAsync();

        var handler = new CheckInTicketCommandHandler(_context, _ticketSecurityService);
        var command = new CheckInTicketCommand(oldToken, Guid.NewGuid(), StaffRole: "Admin");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(400);
        result.Code.Should().Be("QR_SIGNATURE_MISMATCH");
        result.Message.Should().Contain("Mã QR không khớp với bản phát hành hiện tại");
    }

    [Fact]
    public async Task CheckIn_WhenQrSignatureMatchesStoredSignature_ShouldSucceed()
    {
        // Arrange: Ticket signature in DB matches the presented QR token exactly
        var (ev, _, _, ticket) = await SeedTicketAsync(status: TicketStatus.Paid);
        var validToken = _ticketSecurityService.GenerateSignedQrToken(
            ticket.Id,
            ev.Id,
            ticket.OrderCode,
            DateTime.UtcNow.AddHours(2)
        );
        ticket.SetQrSignature(validToken);
        await _context.SaveChangesAsync();

        var handler = new CheckInTicketCommandHandler(_context, _ticketSecurityService);
        var command = new CheckInTicketCommand(validToken, Guid.NewGuid(), StaffRole: "Admin");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.StatusCode.Should().Be(200);
    }

    [Fact]
    public async Task CheckIn_WhenConcurrentScanModifiesTicket_Returns409Conflict()
    {
        // Arrange: Seed paid ticket with matching QR signature
        var (ev, _, _, ticket) = await SeedTicketAsync(status: TicketStatus.Paid);
        var validToken = _ticketSecurityService.GenerateSignedQrToken(
            ticket.Id,
            ev.Id,
            ticket.OrderCode,
            DateTime.UtcNow.AddHours(2)
        );
        ticket.SetQrSignature(validToken);
        await _context.SaveChangesAsync();

        var handler = new CheckInTicketCommandHandler(_context, _ticketSecurityService);
        var command = new CheckInTicketCommand(validToken, Guid.NewGuid(), StaffRole: "Admin");

        // Act: Competing gate station completes check-in right before this handler saves
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite(_connection)
            .Options;
        using var competingContext = new ApplicationDbContext(options);
        var competingTicket = await competingContext.Tickets.FindAsync(ticket.Id);
        competingTicket!.CheckIn(Guid.NewGuid());
        await competingContext.SaveChangesAsync();

        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(409);
        result.Code.Should().Be("CHECKIN_CONCURRENCY_CONFLICT");
    }
}

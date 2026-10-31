using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Moq;
using TickeX.Application.Admin.Commands;
using TickeX.Application.Admin.Queries;
using TickeX.Application.Events.Commands;
using TickeX.Application.Interfaces;
using TickeX.Domain.Entities;
using TickeX.Domain.Enums;
using TickeX.Infrastructure.Persistence;
using TickeX.Infrastructure.Services;
using Xunit;

namespace TickeX.UnitTests.Admin;

public class EventConcurrencyAndAdminAuditTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly ApplicationDbContext _context;

    public EventConcurrencyAndAdminAuditTests()
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
    public async Task UpdateEvent_WithMismatchedVersion_ReturnsConflict()
    {
        // Arrange
        var ev = new Event("Rock Fest", "Rock Concert", DateTime.UtcNow.AddDays(5), DateTime.UtcNow.AddDays(5).AddHours(3), "Hanoi", "National Stadium", 60);
        _context.Events.Add(ev);
        await _context.SaveChangesAsync();

        var staleVersion = Convert.ToBase64String(Guid.NewGuid().ToByteArray());
        var handler = new UpdateEventCommandHandler(_context);

        var command = new UpdateEventCommand(
            ev.Id,
            "Updated Rock Fest",
            ev.Description,
            ev.Date,
            ev.EndDate,
            ev.Location,
            ev.VenueName,
            ev.TotalSeats,
            ev.Category,
            ev.ImageUrl,
            ev.BannerUrl,
            ev.OrganizerName,
            ev.BasePrice,
            ev.Status,
            ev.RefundCutoffHours,
            ExpectedVersion: staleVersion
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(409);
        result.ErrorCode.Should().Be("EVENT_CONCURRENCY_CONFLICT");
    }

    [Fact]
    public async Task UpdateEvent_WithMatchingVersion_SucceedsAndRefreshesVersion()
    {
        // Arrange
        var ev = new Event("Jazz Night", "Jazz Live", DateTime.UtcNow.AddDays(5), DateTime.UtcNow.AddDays(5).AddHours(3), "HCMC", "Opera House", 60);
        _context.Events.Add(ev);
        await _context.SaveChangesAsync();

        var originalVersion = ev.Version;
        var validVersionStr = Convert.ToBase64String(originalVersion);
        var handler = new UpdateEventCommandHandler(_context);

        var command = new UpdateEventCommand(
            ev.Id,
            "Updated Jazz Night",
            ev.Description,
            ev.Date,
            ev.EndDate,
            ev.Location,
            ev.VenueName,
            ev.TotalSeats,
            ev.Category,
            ev.ImageUrl,
            ev.BannerUrl,
            ev.OrganizerName,
            ev.BasePrice,
            ev.Status,
            ev.RefundCutoffHours,
            ExpectedVersion: validVersionStr
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.StatusCode.Should().Be(200);

        var updatedEvent = await _context.Events.FindAsync(ev.Id);
        updatedEvent!.Title.Should().Be("Updated Jazz Night");
        updatedEvent.Version.Should().NotEqual(originalVersion);
    }

    [Fact]
    public async Task CreateEvent_ShouldRecordAuditLog_WithAdminDetails()
    {
        // Arrange
        var adminId = Guid.NewGuid();
        var adminEmail = "lead-admin@tickex.com";
        var clientIp = "192.168.1.100";
        var handler = new CreateEventCommandHandler(_context);

        var command = new CreateEventCommand(
            Title: "EDM Festival",
            Description: "Huge music festival",
            Date: DateTime.UtcNow.AddDays(10),
            EndDate: DateTime.UtcNow.AddDays(10).AddHours(5),
            Location: "Da Nang",
            VenueName: "Convention Center",
            TotalSeats: 60,
            Category: "Festival",
            ImageUrl: "https://example.com/image.jpg",
            AdminUserId: adminId,
            AdminEmail: adminEmail,
            IpAddress: clientIp
        );

        // Act
        var eventId = await handler.Handle(command, CancellationToken.None);

        // Assert
        eventId.Should().NotBeEmpty();

        var auditLog = await _context.AuditLogs.FirstOrDefaultAsync(a => a.EntityId == eventId.ToString());
        auditLog.Should().NotBeNull();
        auditLog!.Action.Should().Be("CREATE_EVENT");
        auditLog.UserId.Should().Be(adminId);
        auditLog.UserEmail.Should().Be(adminEmail);
        auditLog.IpAddress.Should().Be(clientIp);
    }

    [Fact]
    public async Task UpdateEvent_WhenEventIsCompleted_ReturnsBadRequestCannotEditCompleted()
    {
        // Arrange
        var ev = new Event(
            "Completed Concert",
            "Concert Description",
            DateTime.UtcNow.AddDays(-10),
            DateTime.UtcNow.AddDays(-10).AddHours(3),
            "Hanoi",
            "Opera House",
            60,
            status: EventStatus.Completed
        );
        _context.Events.Add(ev);
        await _context.SaveChangesAsync();

        var handler = new UpdateEventCommandHandler(_context);
        var command = new UpdateEventCommand(
            ev.Id,
            "Attempted Title Update",
            ev.Description,
            ev.Date,
            ev.EndDate,
            ev.Location,
            ev.VenueName,
            ev.TotalSeats,
            ev.Category,
            ev.ImageUrl,
            ev.BannerUrl,
            ev.OrganizerName,
            ev.BasePrice,
            ev.Status,
            ev.RefundCutoffHours
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(400);
        result.ErrorCode.Should().Be("CANNOT_EDIT_COMPLETED_EVENT");
    }

    [Fact]
    public async Task CancelEvent_WhenEventIsCompleted_ReturnsBadRequestAlreadyCompleted()
    {
        // Arrange
        var ev = new Event(
            "Completed Music Festival",
            "Festival Description",
            DateTime.UtcNow.AddDays(-5),
            DateTime.UtcNow.AddDays(-5).AddHours(4),
            "HCMC",
            "Saigon Stadium",
            100,
            status: EventStatus.Completed
        );
        _context.Events.Add(ev);
        await _context.SaveChangesAsync();

        var handler = new CancelEventCommandHandler(_context, new RefundRequestPort(_context));
        var command = new CancelEventCommand(ev.Id, "Cancel reason test", ExpectedVersion: Convert.ToBase64String(ev.Version));

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(400);
        result.ErrorCode.Should().Be("EVENT_ALREADY_COMPLETED");
    }

    [Fact]
    public async Task CancelEvent_WithoutExpectedVersion_ReturnsVersionRequired()
    {
        var ev = new Event("Versioned Event", "Description", DateTime.UtcNow.AddDays(2), DateTime.UtcNow.AddDays(2).AddHours(3), "HCMC", "Venue", 10);
        _context.Events.Add(ev);
        await _context.SaveChangesAsync();

        var result = await new CancelEventCommandHandler(_context, new RefundRequestPort(_context))
            .Handle(new CancelEventCommand(ev.Id, "Admin cancellation"), CancellationToken.None);

        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(400);
        result.ErrorCode.Should().Be("VERSION_REQUIRED");
        (await _context.Events.FindAsync(ev.Id))!.Status.Should().NotBe(EventStatus.Cancelled);
    }

    [Fact]
    public async Task CancelEvent_WithStaleExpectedVersion_ReturnsConflictWithoutMutation()
    {
        var ev = new Event("Versioned Event", "Description", DateTime.UtcNow.AddDays(2), DateTime.UtcNow.AddDays(2).AddHours(3), "HCMC", "Venue", 10);
        _context.Events.Add(ev);
        await _context.SaveChangesAsync();

        var staleVersion = Convert.ToBase64String(Guid.NewGuid().ToByteArray());
        var result = await new CancelEventCommandHandler(_context, new RefundRequestPort(_context))
            .Handle(new CancelEventCommand(ev.Id, "Admin cancellation", staleVersion), CancellationToken.None);

        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(409);
        result.ErrorCode.Should().Be("EVENT_CONCURRENCY_CONFLICT");
        (await _context.Events.FindAsync(ev.Id))!.Status.Should().NotBe(EventStatus.Cancelled);
        (await _context.RefundRequests.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task UpdateEvent_WhenSoldTicketsExistAndEndDateModified_ReturnsBadRequestCannotModifyDate()
    {
        // Arrange
        var user = new User("Customer", "cust@example.com", "hash", "Customer");
        _context.Users.Add(user);
        var ev = new Event("Show With Ticket", "Desc", DateTime.UtcNow.AddDays(10), DateTime.UtcNow.AddDays(10).AddHours(3), "Loc", "Venue", 10, basePrice: 100000m);
        ev.GenerateSeatsMatrix(1, 2);
        _context.Events.Add(ev);
        await _context.SaveChangesAsync();

        var ticket = new Ticket(ev.Id, ev.Seats.First().Id, user.Id, 100000m);
        ticket.MarkAsPaid();
        _context.Tickets.Add(ticket);
        await _context.SaveChangesAsync();

        var validVersionStr = Convert.ToBase64String(ev.Version);
        var handler = new UpdateEventCommandHandler(_context);

        // Act: modify EndDate while keeping Date identical
        var command = new UpdateEventCommand(
            ev.Id,
            ev.Title,
            ev.Description,
            ev.Date,
            ev.EndDate.AddHours(2), // EndDate modified
            ev.Location,
            ev.VenueName,
            ev.TotalSeats,
            ev.Category,
            ev.ImageUrl,
            ev.BannerUrl,
            ev.OrganizerName,
            ev.BasePrice,
            ev.Status,
            ev.RefundCutoffHours,
            ExpectedVersion: validVersionStr
        );

        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(400);
        result.ErrorCode.Should().Be("CANNOT_MODIFY_DATE_AFTER_SALES");
    }

    [Fact]
    public async Task DeleteEvent_WithStaleExpectedVersion_ReturnsConflictWithoutDeleting()
    {
        // Arrange
        var ev = new Event("Delete Candidate", "Desc", DateTime.UtcNow.AddDays(5), DateTime.UtcNow.AddDays(5).AddHours(3), "Loc", "Venue", 10);
        _context.Events.Add(ev);
        await _context.SaveChangesAsync();

        var staleVersion = Convert.ToBase64String(Guid.NewGuid().ToByteArray());
        var handler = new DeleteEventCommandHandler(_context);

        // Act
        var result = await handler.Handle(new DeleteEventCommand(ev.Id, ExpectedVersion: staleVersion), CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(409);
        result.ErrorCode.Should().Be("EVENT_CONCURRENCY_CONFLICT");

        var eventInDb = await _context.Events.IgnoreQueryFilters().FirstOrDefaultAsync(e => e.Id == ev.Id);
        eventInDb!.IsDeleted.Should().BeFalse();
    }

    [Fact]
    public async Task UpdateEvent_WhenBasePriceChangesBeforeSales_UpdatesAllSeatPrices()
    {
        // Arrange
        var ev = new Event("Concert", "Desc", DateTime.UtcNow.AddDays(5), DateTime.UtcNow.AddDays(5).AddHours(3), "Loc", "Venue", 4, basePrice: 200000);
        ev.GenerateSeatsMatrix(2, 2); // 4 seats total: VIP rows (tier = VIP, multiplier 1.75m -> 350,000)
        _context.Events.Add(ev);
        await _context.SaveChangesAsync();

        var versionStr = Convert.ToBase64String(ev.Version);
        var handler = new UpdateEventCommandHandler(_context);

        var newBasePrice = 300000m;
        var command = new UpdateEventCommand(
            ev.Id,
            ev.Title,
            ev.Description,
            ev.Date,
            ev.EndDate,
            ev.Location,
            ev.VenueName,
            ev.TotalSeats,
            ev.Category,
            ev.ImageUrl,
            ev.BannerUrl,
            ev.OrganizerName,
            newBasePrice,
            ev.Status,
            ev.RefundCutoffHours,
            ExpectedVersion: versionStr
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        var seats = await _context.Seats.Where(s => s.EventId == ev.Id).ToListAsync();
        seats.Should().NotBeEmpty();
        // Standard seats (multiplier 1.0) must be 300,000, VIP seats (multiplier 1.75) must be 525,000
        foreach (var seat in seats)
        {
            if (seat.Tier == SeatTier.VIP)
            {
                seat.Price.Should().Be(525000m);
            }
            else
            {
                seat.Price.Should().Be(300000m);
            }
        }
    }

    [Fact]
    public async Task UpdateProfile_WithNullPhoneAndAvatar_NormalizesToEmptyString()
    {
        // Arrange
        var user = new User("Alice", "alice@test.local", "hash");
        user.UpdateProfile("Alice", "0912345678", "https://avatar.png");
        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        var handler = new TickeX.Application.Users.Commands.UpdateProfileCommandHandler(_context);

        // Act - Client sends null phone and avatar
        var result = await handler.Handle(new TickeX.Application.Users.Commands.UpdateProfileCommand(user.Id, "Alice New", null!, null!), CancellationToken.None);

        // Assert
        result.Should().BeTrue();
        var updated = await _context.Users.FindAsync(user.Id);
        updated!.Phone.Should().Be(string.Empty);
        updated.AvatarUrl.Should().Be(string.Empty);
    }

    [Fact]
    public async Task SaveRefundBankAccount_RecordsUserEmailInAuditLog()
    {
        // Arrange
        var user = new User("Bob", "bob@test.local", "hash");
        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        var protector = new Mock<IRefundBankAccountProtector>();
        protector.Setup(x => x.Protect(It.IsAny<RefundBankAccountDetails>()))
            .Returns("encrypted-token");

        var handler = new TickeX.Application.Users.Commands.SaveRefundBankAccountCommandHandler(_context, protector.Object);

        // Act
        var result = await handler.Handle(new TickeX.Application.Users.Commands.SaveRefundBankAccountCommand(user.Id, "970415", "BOB TEST", "1234567890"), CancellationToken.None);

        // Assert
        result.Should().BeTrue();
        var log = await _context.AuditLogs.FirstOrDefaultAsync(l => l.Action == "REFUND_BANK_ACCOUNT_UPDATED");
        log.Should().NotBeNull();
        log!.UserEmail.Should().Be("bob@test.local");
    }

    [Fact]
    public async Task GetRefundRequestsQuery_ProjectsNonEmptyBase64Version()
    {
        var refund = new RefundRequest(Guid.NewGuid(), Guid.NewGuid(), 150000m, "idem-test-version");
        _context.RefundRequests.Add(refund);
        await _context.SaveChangesAsync();

        var handler = new GetRefundRequestsQueryHandler(_context);
        var result = await handler.Handle(new GetRefundRequestsQuery(1, 10), CancellationToken.None);

        result.Items.Should().ContainSingle();
        var item = result.Items[0];
        item.Version.Should().NotBeNullOrWhiteSpace();
        Convert.FromBase64String(item.Version!).Should().NotBeEmpty();
    }

    [Fact]
    public async Task RetryRefundRequest_WhenLockAcquisitionThrows_ReturnsReconciliationLockUnavailable()
    {
        var refund = new RefundRequest(Guid.NewGuid(), Guid.NewGuid(), 100000m, "idem-lock-test");
        _context.RefundRequests.Add(refund);
        await _context.SaveChangesAsync();

        var locksMock = new Mock<IDistributedLockService>();
        locksMock.Setup(l => l.AcquireLockAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("Redis unavailable"));

        var handler = new RetryRefundRequestCommandHandler(
            _context,
            Mock.Of<IPayOSPayoutService>(),
            Mock.Of<IRefundBankAccountProtector>(),
            locksMock.Object);

        var result = await handler.Handle(new RetryRefundRequestCommand(refund.Id), CancellationToken.None);
        result.Should().Be("REFUND_RECONCILIATION_LOCK_UNAVAILABLE");
    }

    [Fact]
    public async Task RetryRefundRequest_WhenLeaseIsInvalid_ReturnsReconciliationLockLost()
    {
        var refund = new RefundRequest(Guid.NewGuid(), Guid.NewGuid(), 100000m, "idem-lease-lost-test");
        _context.RefundRequests.Add(refund);
        await _context.SaveChangesAsync();

        var leaseMock = new Mock<IDistributedLockLease>();
        leaseMock.SetupGet(l => l.IsValid).Returns(false);

        var locksMock = new Mock<IDistributedLockService>();
        locksMock.Setup(l => l.AcquireLockAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(leaseMock.Object);

        var handler = new RetryRefundRequestCommandHandler(
            _context,
            Mock.Of<IPayOSPayoutService>(),
            Mock.Of<IRefundBankAccountProtector>(),
            locksMock.Object);

        var result = await handler.Handle(new RetryRefundRequestCommand(refund.Id), CancellationToken.None);
        result.Should().Be("REFUND_RECONCILIATION_LOCK_LOST");
    }

    [Fact]
    public async Task RetryRefundRequest_WhenExpectedVersionMismatches_ReturnsRefundConcurrencyConflict()
    {
        var refund = new RefundRequest(Guid.NewGuid(), Guid.NewGuid(), 100000m, "idem-stale-version-test");
        refund.MarkNeedsReview("Terminal error", "FAILED");
        _context.RefundRequests.Add(refund);
        await _context.SaveChangesAsync();

        var leaseMock = new Mock<IDistributedLockLease>();
        leaseMock.SetupGet(l => l.IsValid).Returns(true);

        var locksMock = new Mock<IDistributedLockService>();
        locksMock.Setup(l => l.AcquireLockAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(leaseMock.Object);

        var staleVersion = Convert.ToBase64String(Guid.NewGuid().ToByteArray());
        var handler = new RetryRefundRequestCommandHandler(
            _context,
            Mock.Of<IPayOSPayoutService>(),
            Mock.Of<IRefundBankAccountProtector>(),
            locksMock.Object);

        var result = await handler.Handle(new RetryRefundRequestCommand(refund.Id, staleVersion), CancellationToken.None);
        result.Should().Be("REFUND_CONCURRENCY_CONFLICT");
    }
}

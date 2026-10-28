using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using TickeX.Application.Interfaces;
using TickeX.Application.Payments.Commands;
using TickeX.Domain.Entities;
using TickeX.Domain.Enums;
using TickeX.Infrastructure.Persistence;
using TickeX.Infrastructure.Services;
using Xunit;

namespace TickeX.UnitTests.Payments;

public class ConcurrencyAndPaymentTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly ApplicationDbContext _context;

    public ConcurrencyAndPaymentTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();
        _context = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite(_connection)
            .Options);
        _context.Database.EnsureCreated();
    }

    public void Dispose()
    {
        _context.Dispose();
        _connection.Dispose();
    }

    [Fact]
    public void PaymentTransaction_MarkSuccess_ShouldBeIdempotent()
    {
        // Arrange
        var tx = new PaymentTransaction(889911L, Guid.NewGuid(), 250000);

        // Act
        tx.MarkSuccess("TX12345", "{}");
        var firstProcessedAt = tx.ProcessedAt;

        // Second duplicate webhook call
        tx.MarkSuccess("TX12345", "{}");

        // Assert
        tx.Status.Should().Be("Success");
        tx.ProviderTransactionId.Should().Be("TX12345");
        tx.Amount.Should().Be(250000);
    }

    [Fact]
    public void PaymentTransaction_MarkRefundInitiated_And_MarkRefunded_ShouldTransitionProperly()
    {
        // Arrange
        var tx = new PaymentTransaction(889911L, Guid.NewGuid(), 500000);
        tx.MarkSuccess("TX99999", "{}");

        // Act
        tx.MarkRefundInitiated("Refund request received");
        tx.Status.Should().Be("RefundInitiated");

        tx.MarkRefunded("REFUND_TX_001", "Refund completed");

        // Assert
        tx.Status.Should().Be("Refunded");
        tx.ProviderTransactionId.Should().Be("REFUND_TX_001");
    }

    [Fact]
    public void PaymentTransaction_MarkOrphaned_ShouldFlagCompensationState()
    {
        // Arrange
        var tx = new PaymentTransaction(778899L, Guid.NewGuid(), 350000);

        // Act
        tx.MarkOrphaned("Hold expired: Cancelled", "PAYOS_TX_999", "{\"code\":\"00\"}");

        // Assert
        tx.Status.Should().Be("OrphanedPaid");
        tx.ProviderTransactionId.Should().Be("PAYOS_TX_999");
        tx.RawWebhookPayload.Should().Contain("Hold expired: Cancelled");
        tx.Amount.Should().Be(350000);
    }

    [Fact]
    public async Task ProcessPayment_WhenSeatLockContended_ShouldDisposeAcquiredEventLockLease()
    {
        // Arrange
        var user = new User("User", "user@test.local", "hash");
        var ev = new Event("Concert", "Desc", DateTime.UtcNow.AddDays(5), DateTime.UtcNow.AddDays(5).AddHours(3), "Loc", "Venue", 1, "Music", basePrice: 100000);
        ev.GenerateSeatsMatrix(1, 1);
        _context.AddRange(user, ev);
        await _context.SaveChangesAsync();

        var seat = await _context.Seats.FirstAsync();
        seat.Lock(user.Id);
        var ticket = new Ticket(ev.Id, seat.Id, user.Id, seat.Price);
        _context.Tickets.Add(ticket);
        await _context.SaveChangesAsync();

        var eventLeaseMock = new Mock<IDistributedLockLease>();
        eventLeaseMock.SetupGet(x => x.IsValid).Returns(true);
        eventLeaseMock.Setup(x => x.DisposeAsync()).Returns(ValueTask.CompletedTask);

        var lockService = new Mock<IDistributedLockService>();
        lockService.Setup(x => x.AcquireLockAsync($"event:cancel:{ev.Id:N}", It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(eventLeaseMock.Object);
        // Seat lock fails (returns null or throws)
        lockService.Setup(x => x.AcquireLockAsync($"seat:lock:{seat.Id:N}", It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((IDistributedLockLease?)null);

        var notifications = new Mock<ISeatNotificationService>();
        var outbox = new Mock<INotificationOutboxPort>();
        var ticketSecurity = new Mock<ITicketSecurityService>();

        var handler = new ProcessPaymentCommandHandler(
            _context, outbox.Object, notifications.Object, lockService.Object,
            ticketSecurity.Object, NullLogger<ProcessPaymentCommandHandler>.Instance);

        var webhookData = new PayOSWebhookData
        {
            OrderCode = ticket.OrderCode,
            Amount = ticket.Price,
            Success = true,
            Reference = "payos-ref",
            Code = "00"
        };

        // Act
        var result = await handler.Handle(new ProcessPaymentCommand(webhookData), CancellationToken.None);

        // Assert
        result.Should().BeFalse();
        // Invariant: The acquired event lock lease MUST be disposed even when subsequent lock acquisitions fail
        eventLeaseMock.Verify(x => x.DisposeAsync(), Times.Once);
    }

    [Fact]
    public async Task ProcessPayment_WhenPaymentLockContended_ShouldDisposeBothEventAndSeatLockLeases()
    {
        // Arrange
        var user = new User("User", "user@test.local", "hash");
        var ev = new Event("Concert", "Desc", DateTime.UtcNow.AddDays(5), DateTime.UtcNow.AddDays(5).AddHours(3), "Loc", "Venue", 1, "Music", basePrice: 100000);
        ev.GenerateSeatsMatrix(1, 1);
        _context.AddRange(user, ev);
        await _context.SaveChangesAsync();

        var seat = await _context.Seats.FirstAsync();
        seat.Lock(user.Id);
        var ticket = new Ticket(ev.Id, seat.Id, user.Id, seat.Price);
        _context.Tickets.Add(ticket);
        await _context.SaveChangesAsync();

        var eventLeaseMock = new Mock<IDistributedLockLease>();
        eventLeaseMock.SetupGet(x => x.IsValid).Returns(true);
        eventLeaseMock.Setup(x => x.DisposeAsync()).Returns(ValueTask.CompletedTask);

        var seatLeaseMock = new Mock<IDistributedLockLease>();
        seatLeaseMock.SetupGet(x => x.IsValid).Returns(true);
        seatLeaseMock.Setup(x => x.DisposeAsync()).Returns(ValueTask.CompletedTask);

        var lockService = new Mock<IDistributedLockService>();
        lockService.Setup(x => x.AcquireLockAsync($"event:cancel:{ev.Id:N}", It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(eventLeaseMock.Object);
        lockService.Setup(x => x.AcquireLockAsync($"seat:lock:{seat.Id:N}", It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(seatLeaseMock.Object);
        // Payment lock fails
        lockService.Setup(x => x.AcquireLockAsync($"payment:lock:{ticket.OrderCode}", It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((IDistributedLockLease?)null);

        var notifications = new Mock<ISeatNotificationService>();
        var outbox = new Mock<INotificationOutboxPort>();
        var ticketSecurity = new Mock<ITicketSecurityService>();

        var handler = new ProcessPaymentCommandHandler(
            _context, outbox.Object, notifications.Object, lockService.Object,
            ticketSecurity.Object, NullLogger<ProcessPaymentCommandHandler>.Instance);

        var webhookData = new PayOSWebhookData
        {
            OrderCode = ticket.OrderCode,
            Amount = ticket.Price,
            Success = true,
            Reference = "payos-ref",
            Code = "00"
        };

        // Act
        var result = await handler.Handle(new ProcessPaymentCommand(webhookData), CancellationToken.None);

        // Assert
        result.Should().BeFalse();
        eventLeaseMock.Verify(x => x.DisposeAsync(), Times.Once);
        seatLeaseMock.Verify(x => x.DisposeAsync(), Times.Once);
    }
}

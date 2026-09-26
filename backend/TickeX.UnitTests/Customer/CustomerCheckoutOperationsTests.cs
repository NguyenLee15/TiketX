using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using TickeX.Application.Interfaces;
using TickeX.Domain.Entities;
using TickeX.Domain.Enums;
using TickeX.Infrastructure.Persistence;
using TickeX.Infrastructure.Services;
using Xunit;

namespace TickeX.UnitTests.Customer;

public sealed class CustomerCheckoutOperationsTests : IDisposable
{
    private readonly SqliteConnection _connection = new("DataSource=:memory:");
    private readonly ApplicationDbContext _context;

    public CustomerCheckoutOperationsTests()
    {
        _connection.Open();
        _context = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite(_connection).Options);
        _context.Database.EnsureCreated();
    }

    [Fact]
    public async Task CreatePaymentLink_ReusesActiveCheckoutForTheTicketOwner()
    {
        var user = new User("Customer", "checkout@test.local", "hash");
        var @event = new Event("Future", "Description", DateTime.UtcNow.AddDays(2), DateTime.UtcNow.AddDays(2).AddHours(2), "HCM", "Venue", 1);
        @event.GenerateSeatsMatrix(1, 1);
        _context.AddRange(user, @event);
        await _context.SaveChangesAsync();
        var seat = await _context.Seats.SingleAsync();
        seat.Lock(user.Id);
        var ticket = new Ticket(@event.Id, seat.Id, user.Id, seat.Price);
        _context.Tickets.Add(ticket);
        await _context.SaveChangesAsync();

        var payos = new Mock<IPayOSService>();
        payos.Setup(x => x.CreatePaymentLink(It.IsAny<long>(), It.IsAny<int>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CreatePaymentResult { CheckoutUrl = "https://pay.example/checkout" });
        var operations = CreateOperations(payos.Object);

        var first = await operations.CreatePaymentLinkAsync(ticket.Id, user.Id, CancellationToken.None);
        var second = await operations.CreatePaymentLinkAsync(ticket.Id, user.Id, CancellationToken.None);

        first.Success.Should().BeTrue();
        second.CheckoutUrl.Should().Be("https://pay.example/checkout");
        payos.Verify(x => x.CreatePaymentLink(It.IsAny<long>(), It.IsAny<int>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task CreatePaymentLink_WhenPendingIntentAlreadyExists_ReturnsInProgressWithoutCallingPayOS()
    {
        var user = new User("Customer", "competing@test.local", "hash");
        var @event = new Event("Future", "Description", DateTime.UtcNow.AddDays(2), DateTime.UtcNow.AddDays(2).AddHours(2), "HCM", "Venue", 1);
        @event.GenerateSeatsMatrix(1, 1);
        _context.AddRange(user, @event);
        await _context.SaveChangesAsync();
        var seat = await _context.Seats.SingleAsync();
        seat.Lock(user.Id);
        var ticket = new Ticket(@event.Id, seat.Id, user.Id, seat.Price);
        _context.Tickets.Add(ticket);
        await _context.SaveChangesAsync();

        // Simulate an intent pre-persisted by a competing in-flight request (without checkout URL yet)
        var pendingIntent = new PaymentTransaction(ticket.OrderCode, ticket.Id, ticket.Price, "VietQR_PayOS");
        _context.PaymentTransactions.Add(pendingIntent);
        await _context.SaveChangesAsync();

        var payos = new Mock<IPayOSService>();
        var operations = CreateOperations(payos.Object);

        var result = await operations.CreatePaymentLinkAsync(ticket.Id, user.Id, CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Code.Should().Be("PAYMENT_LINK_IN_PROGRESS");
        payos.Verify(x => x.CreatePaymentLink(It.IsAny<long>(), It.IsAny<int>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task CreatePaymentLink_WhenProviderTimesOut_AllowsSubsequentRetryToSucceed()
    {
        var user = new User("Customer", "retry-link@test.local", "hash");
        var @event = new Event("Future", "Description", DateTime.UtcNow.AddDays(2), DateTime.UtcNow.AddDays(2).AddHours(2), "HCM", "Venue", 1);
        @event.GenerateSeatsMatrix(1, 1);
        _context.AddRange(user, @event);
        await _context.SaveChangesAsync();
        var seat = await _context.Seats.SingleAsync();
        seat.Lock(user.Id);
        var ticket = new Ticket(@event.Id, seat.Id, user.Id, seat.Price);
        _context.Tickets.Add(ticket);
        await _context.SaveChangesAsync();

        var payos = new Mock<IPayOSService>();
        // First attempt times out, second succeeds
        payos.SetupSequence(x => x.CreatePaymentLink(It.IsAny<long>(), It.IsAny<int>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new TimeoutException())
            .ReturnsAsync(new CreatePaymentResult { CheckoutUrl = "https://pay.payos.vn/web/test-retry-123" });

        var operations = CreateOperations(payos.Object);

        // First attempt fails cleanly
        var firstResult = await operations.CreatePaymentLinkAsync(ticket.Id, user.Id, CancellationToken.None);
        firstResult.Success.Should().BeFalse();
        firstResult.Code.Should().Be("PAYMENT_PROVIDER_ERROR");

        // Second attempt retries under the hold window and succeeds!
        var secondResult = await operations.CreatePaymentLinkAsync(ticket.Id, user.Id, CancellationToken.None);
        secondResult.Success.Should().BeTrue();
        secondResult.CheckoutUrl.Should().Be("https://pay.payos.vn/web/test-retry-123");
        var tx = await _context.PaymentTransactions.SingleAsync(x => x.TicketId == ticket.Id);
        tx.CheckoutUrl.Should().Be("https://pay.payos.vn/web/test-retry-123");
        tx.Status.Should().Be("Pending");
    }

    [Fact]
    public async Task GetPaymentStatus_OnlyReturnsTheOwnerOrder()
    {
        var owner = new User("Owner", "owner@test.local", "hash");
        var other = new User("Other", "other@test.local", "hash");
        var @event = new Event("Future", "Description", DateTime.UtcNow.AddDays(2), DateTime.UtcNow.AddDays(2).AddHours(2), "HCM", "Venue", 1);
        @event.GenerateSeatsMatrix(1, 1);
        _context.AddRange(owner, other, @event);
        await _context.SaveChangesAsync();
        var ticket = new Ticket(@event.Id, (await _context.Seats.SingleAsync()).Id, owner.Id, 100000);
        _context.Tickets.Add(ticket);
        await _context.SaveChangesAsync();

        var result = await CreateOperations(Mock.Of<IPayOSService>()).GetStatusAsync(ticket.OrderCode, other.Id, CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Code.Should().Be("PAYMENT_NOT_FOUND");
    }

    private CustomerCheckoutOperations CreateOperations(IPayOSService payos)
    {
        var settings = new Dictionary<string, string?>
        {
            ["PayOS:ReturnUrl"] = "https://tickex.local/payment-result",
            ["PayOS:CancelUrl"] = "https://tickex.local/my-tickets",
            ["PayOS:ClientId"] = "configured"
        };
        var mediator = new Mock<MediatR.IMediator>();
        var environment = new Mock<IHostEnvironment>();
        environment.SetupGet(x => x.EnvironmentName).Returns(Environments.Production);
        return new CustomerCheckoutOperations(_context, payos, mediator.Object,
            new ConfigurationBuilder().AddInMemoryCollection(settings).Build(), environment.Object,
            NullLogger<CustomerCheckoutOperations>.Instance);
    }

    public void Dispose()
    {
        _context.Dispose();
        _connection.Dispose();
    }
}

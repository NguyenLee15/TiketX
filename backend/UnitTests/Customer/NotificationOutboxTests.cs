using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using TickeX.Application.Interfaces;
using TickeX.Application.Payments.Events;
using TickeX.Domain.Entities;
using TickeX.Infrastructure.Messaging;
using TickeX.Infrastructure.Persistence;
using TickeX.Infrastructure.Services;
using Xunit;

namespace TickeX.UnitTests.Customer;

public sealed class NotificationOutboxTests : IDisposable
{
    private readonly SqliteConnection _connection = new("DataSource=:memory:");

    public NotificationOutboxTests() => _connection.Open();

    [Fact]
    public async Task QueueTicketPaidAsync_PersistsOneDurableItemForDuplicatePaymentNotification()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(_connection).Options;
        await using var context = new ApplicationDbContext(options);
        await context.Database.EnsureCreatedAsync();
        var ticketId = Guid.NewGuid();
        var port = new NotificationOutboxPort(context);

        var first = await port.QueueTicketPaidAsync(ticketId, Guid.NewGuid(), Guid.NewGuid(), CancellationToken.None);
        var duplicate = await port.QueueTicketPaidAsync(ticketId, Guid.NewGuid(), Guid.NewGuid(), CancellationToken.None);

        first.Should().Be(NotificationOutboxEnqueueResult.Created);
        duplicate.Should().Be(NotificationOutboxEnqueueResult.AlreadyExists);
        (await context.NotificationOutbox.CountAsync()).Should().Be(1);
    }

    [Fact]
    public void OutboxItem_MarkProcessing_AcquiresLeaseAndPreventsImmediateReclaim()
    {
        var item = new TickeX.Domain.Entities.NotificationOutboxItem(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        item.Status.Should().Be("Pending");

        item.MarkProcessing(TimeSpan.FromMinutes(2));

        item.Status.Should().Be("Processing");
        item.NextAttemptAt.Should().BeAfter(DateTime.UtcNow.AddMinutes(1));
    }

    [Fact]
    public void OutboxItem_MarkFailed_SanitizesErrorAndSchedulesRetry()
    {
        var item = new TickeX.Domain.Entities.NotificationOutboxItem(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        item.MarkProcessing(TimeSpan.FromMinutes(2));

        item.MarkFailed("PublishFailed: TimeoutException", TimeSpan.FromMinutes(1));

        item.Status.Should().Be("Pending");
        item.AttemptCount.Should().Be(1);
        item.LastError.Should().Be("PublishFailed: TimeoutException");
        item.NextAttemptAt.Should().BeAfter(DateTime.UtcNow.AddSeconds(30));
    }

    [Fact]
    public async Task AtomicClaim_WhenConcurrentReplicasClaimPendingItems_OnlyOneInstanceClaimsEachItem()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(_connection).Options;
        await using var setupContext = new ApplicationDbContext(options);
        await setupContext.Database.EnsureCreatedAsync();

        var item1 = new TickeX.Domain.Entities.NotificationOutboxItem(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var item2 = new TickeX.Domain.Entities.NotificationOutboxItem(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        setupContext.NotificationOutbox.AddRange(item1, item2);
        await setupContext.SaveChangesAsync();

        await using var contextA = new ApplicationDbContext(options);
        await using var contextB = new ApplicationDbContext(options);

        var utcNow = DateTime.UtcNow;
        var candidateIdsA = await contextA.NotificationOutbox
            .Where(x => (x.Status == "Pending" && (x.NextAttemptAt == null || x.NextAttemptAt <= utcNow))
                     || (x.Status == "Processing" && x.NextAttemptAt <= utcNow))
            .Select(x => x.Id)
            .ToListAsync();

        var candidateIdsB = await contextB.NotificationOutbox
            .Where(x => (x.Status == "Pending" && (x.NextAttemptAt == null || x.NextAttemptAt <= utcNow))
                     || (x.Status == "Processing" && x.NextAttemptAt <= utcNow))
            .Select(x => x.Id)
            .ToListAsync();

        candidateIdsA.Should().HaveCount(2);
        candidateIdsB.Should().HaveCount(2);

        var leaseTokenA = "lease:replica-A";
        var leaseTokenB = "lease:replica-B";
        var leaseUntil = utcNow.AddMinutes(2);

        // Replica A claims first
        var claimedA = await contextA.NotificationOutbox
            .Where(x => candidateIdsA.Contains(x.Id) &&
                       ((x.Status == "Pending" && (x.NextAttemptAt == null || x.NextAttemptAt <= utcNow))
                     || (x.Status == "Processing" && x.NextAttemptAt <= utcNow)))
            .ExecuteUpdateAsync(s => s
                .SetProperty(b => b.Status, "Processing")
                .SetProperty(b => b.NextAttemptAt, leaseUntil)
                .SetProperty(b => b.LastError, leaseTokenA)
                .SetProperty(b => b.UpdatedAt, utcNow));

        // Replica B attempts concurrent claim
        var claimedB = await contextB.NotificationOutbox
            .Where(x => candidateIdsB.Contains(x.Id) &&
                       ((x.Status == "Pending" && (x.NextAttemptAt == null || x.NextAttemptAt <= utcNow))
                     || (x.Status == "Processing" && x.NextAttemptAt <= utcNow)))
            .ExecuteUpdateAsync(s => s
                .SetProperty(b => b.Status, "Processing")
                .SetProperty(b => b.NextAttemptAt, leaseUntil)
                .SetProperty(b => b.LastError, leaseTokenB)
                .SetProperty(b => b.UpdatedAt, utcNow));

        claimedA.Should().Be(2);
        claimedB.Should().Be(0);

        var itemsA = await contextA.NotificationOutbox.Where(x => x.LastError == leaseTokenA).ToListAsync();
        var itemsB = await contextB.NotificationOutbox.Where(x => x.LastError == leaseTokenB).ToListAsync();

        itemsA.Should().HaveCount(2);
        itemsB.Should().BeEmpty();
    }

    [Fact]
    public async Task TicketPaidEventConsumer_ProcessEvent_DeduplicatesRepeatedDeliveriesAndReleasesClaimOnFailure()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(_connection).Options;
        await using var context = new ApplicationDbContext(options);
        await context.Database.EnsureCreatedAsync();

        var user = new User("Customer", "customer@test.local", "hash");
        var @event = new Event("Concert", "Desc", DateTime.UtcNow.AddDays(1), DateTime.UtcNow.AddDays(1).AddHours(2), "Loc", "Venue", 100);
        @event.GenerateSeatsMatrix(1, 1);
        context.AddRange(user, @event);
        await context.SaveChangesAsync();

        var seat = await context.Seats.SingleAsync();
        var ticket = new Ticket(@event.Id, seat.Id, user.Id, 100000m);
        context.Tickets.Add(ticket);
        await context.SaveChangesAsync();

        var emailService = new Mock<IEmailService>();
        var idempotencyStore = new Mock<IIdempotencyStore>();

        var services = new ServiceCollection();
        services.AddScoped<IApplicationDbContext>(_ => context);
        services.AddSingleton(emailService.Object);
        services.AddSingleton(idempotencyStore.Object);
        var provider = services.BuildServiceProvider();

        var ticketEvent = new TicketPaidEvent(ticket.Id, user.Id, @event.Id);
        var expectedKey = $"idempotency:consumer:ticket_paid:{ticket.Id:N}";

        // Step 1: First delivery -> Claim acquired
        idempotencyStore.Setup(s => s.TryClaimAsync(expectedKey, "PROCESSING", It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new IdempotencyClaim(true, null, "owner-token-1"));

        await TicketPaidEventConsumer.ProcessEventWithIdempotencyAsync(
            ticketEvent, provider, NullLogger.Instance, CancellationToken.None);

        emailService.Verify(e => e.SendEmailAsync(user.Email, It.IsAny<string>(), It.IsAny<string>()), Times.Once);
        idempotencyStore.Verify(s => s.CompleteAsync(expectedKey, "owner-token-1", "COMPLETED", It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()), Times.Once);

        // Step 2: Second (duplicate) delivery -> Claim NOT acquired
        idempotencyStore.Setup(s => s.TryClaimAsync(expectedKey, "PROCESSING", It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new IdempotencyClaim(false, "owner-token-1\nCOMPLETED", string.Empty));

        await TicketPaidEventConsumer.ProcessEventWithIdempotencyAsync(
            ticketEvent, provider, NullLogger.Instance, CancellationToken.None);

        // Email service must STILL have been called only once!
        emailService.Verify(e => e.SendEmailAsync(user.Email, It.IsAny<string>(), It.IsAny<string>()), Times.Once);

        // Step 3: Transient error during processing -> Claim released
        idempotencyStore.Setup(s => s.TryClaimAsync(expectedKey, "PROCESSING", It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new IdempotencyClaim(true, null, "owner-token-2"));
        emailService.Setup(e => e.SendEmailAsync(user.Email, It.IsAny<string>(), It.IsAny<string>()))
            .ThrowsAsync(new InvalidOperationException("SMTP connection dropped"));

        Func<Task> act = async () => await TicketPaidEventConsumer.ProcessEventWithIdempotencyAsync(
            ticketEvent, provider, NullLogger.Instance, CancellationToken.None);

        await act.Should().ThrowAsync<InvalidOperationException>();
        idempotencyStore.Verify(s => s.ReleaseAsync(expectedKey, "owner-token-2", It.IsAny<CancellationToken>()), Times.Once);
    }

    public void Dispose() => _connection.Dispose();
}

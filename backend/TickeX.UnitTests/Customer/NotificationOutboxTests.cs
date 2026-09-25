using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Interfaces;
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

    public void Dispose() => _connection.Dispose();
}

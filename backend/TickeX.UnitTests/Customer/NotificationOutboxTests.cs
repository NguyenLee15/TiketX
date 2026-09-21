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

    public void Dispose() => _connection.Dispose();
}

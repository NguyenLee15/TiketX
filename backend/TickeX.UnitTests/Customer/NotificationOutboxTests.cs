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

    public void Dispose() => _connection.Dispose();
}

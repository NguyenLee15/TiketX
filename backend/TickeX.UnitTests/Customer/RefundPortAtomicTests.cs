using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Interfaces;
using TickeX.Infrastructure.Persistence;
using TickeX.Infrastructure.Services;
using Xunit;

namespace TickeX.UnitTests.Customer;

public sealed class RefundPortAtomicTests : IDisposable
{
    private readonly SqliteConnection _connection = new("DataSource=:memory:");

    public RefundPortAtomicTests() => _connection.Open();

    [Fact]
    public async Task EnqueueAsync_WhenUniqueKeyAlreadyCommitted_ReturnsAlreadyExistsWithoutThrowing()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(_connection).Options;
        await using var firstContext = new ApplicationDbContext(options);
        await firstContext.Database.EnsureCreatedAsync();
        await using var secondContext = new ApplicationDbContext(options);
        var item = new RefundEnqueueItem(Guid.NewGuid(), Guid.NewGuid(), 250000m, "customer-refund:test");

        var first = await new RefundRequestPort(firstContext).EnqueueAsync([item], CancellationToken.None);
        var duplicate = await new RefundRequestPort(secondContext).EnqueueAsync([item], CancellationToken.None);

        first.Should().Be(RefundEnqueueResult.Created);
        duplicate.Should().Be(RefundEnqueueResult.AlreadyExists);
        (await secondContext.RefundRequests.CountAsync()).Should().Be(1);
    }

    public void Dispose() => _connection.Dispose();
}

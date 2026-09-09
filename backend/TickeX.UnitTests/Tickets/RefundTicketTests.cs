using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Moq;
using TickeX.Application.Interfaces;
using TickeX.Application.Tickets.Commands;
using TickeX.Infrastructure.Persistence;
using TickeX.Infrastructure.Services;
using Xunit;

namespace TickeX.UnitTests.Tickets;

public sealed class RefundTicketTests : IDisposable
{
    private readonly SqliteConnection _connection = new("DataSource=:memory:");
    private readonly ApplicationDbContext _context;

    public RefundTicketTests()
    {
        _connection.Open();
        _context = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite(_connection)
            .Options);
        _context.Database.EnsureCreated();
    }

    [Fact]
    public async Task Handle_WhenDistributedLockIsUnavailable_FailsClosedWithoutMutation()
    {
        var lockService = new Mock<IDistributedLockService>();
        lockService
            .Setup(x => x.AcquireLockAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("Redis unavailable"));

        var handler = new RefundTicketCommandHandler(_context, lockService.Object, new RefundRequestPort(_context));

        var result = await handler.Handle(
            new RefundTicketCommand(Guid.NewGuid(), Guid.NewGuid()),
            CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Code.Should().Be("REFUND_LOCK_UNAVAILABLE");
        _context.ChangeTracker.HasChanges().Should().BeFalse();
    }

    public void Dispose()
    {
        _context.Dispose();
        _connection.Dispose();
    }
}

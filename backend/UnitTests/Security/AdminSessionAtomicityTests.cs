using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Moq;
using TickeX.Application.Admin.Commands;
using TickeX.Application.Interfaces;
using TickeX.Domain.Entities;
using TickeX.Infrastructure.Persistence;
using Xunit;

namespace TickeX.UnitTests.Security;

public sealed class AdminSessionAtomicityTests : IDisposable
{
    private readonly SqliteConnection _connection = new("DataSource=:memory:");
    private readonly ApplicationDbContext _context;

    public AdminSessionAtomicityTests()
    {
        _connection.Open();
        _context = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite(_connection)
            .Options);
        _context.Database.EnsureCreated();
    }

    [Fact]
    public async Task ChangeRole_WhenSessionRevocationFails_RollsBackRoleAndAudit()
    {
        var user = new User("Customer", "admin-atomicity@test.local", "hash", "Customer");
        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        var locks = new Mock<IDistributedLockService>();
        locks.Setup(x => x.AcquireLockAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TestLease());
        var refreshTokens = new Mock<IRefreshTokenStore>();
        refreshTokens.Setup(x => x.RevokeAllForUserAsync(user.Id, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("revocation unavailable"));

        var handler = new ChangeUserRoleCommandHandler(_context, locks.Object, refreshTokens.Object);

        await FluentActions.Invoking(() => handler.Handle(
                new ChangeUserRoleCommand(user.Id, "Staff"), CancellationToken.None))
            .Should().ThrowAsync<InvalidOperationException>();

        using var verificationContext = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite(_connection)
            .Options);
        (await verificationContext.Users.SingleAsync(x => x.Id == user.Id)).Role.Should().Be("Customer");
        (await verificationContext.AuditLogs.CountAsync()).Should().Be(0);
    }

    private sealed class TestLease : IDistributedLockLease
    {
        public bool IsValid => true;
        public ValueTask DisposeAsync() => ValueTask.CompletedTask;
    }

    public void Dispose()
    {
        _context.Dispose();
        _connection.Dispose();
    }
}

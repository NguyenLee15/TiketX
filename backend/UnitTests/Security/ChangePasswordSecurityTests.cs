using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Moq;
using TickeX.Application.Interfaces;
using TickeX.Application.Users.Commands;
using TickeX.Domain.Entities;
using TickeX.Infrastructure.Persistence;

namespace TickeX.UnitTests.Security;

public sealed class ChangePasswordSecurityTests : IDisposable
{
    private readonly SqliteConnection _connection = new("DataSource=:memory:");
    private readonly ApplicationDbContext _context;

    public ChangePasswordSecurityTests()
    {
        _connection.Open();
        _context = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite(_connection)
            .Options);
        _context.Database.EnsureCreated();
    }

    [Fact]
    public async Task ChangePassword_WhenSessionRevocationFails_RollsBackPasswordChange()
    {
        var user = new User("Customer", "password-atomic@test.local", "old-hash");
        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        var hasher = new Mock<IPasswordHasher>();
        hasher.Setup(x => x.Verify("old-password", "old-hash")).Returns(true);
        hasher.Setup(x => x.Hash("NewPassword2026")).Returns("new-hash");

        var refreshTokens = new Mock<IRefreshTokenStore>();
        refreshTokens
            .Setup(x => x.RevokeAllForUserAsync(user.Id, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("revocation unavailable"));

        var handler = new ChangePasswordCommandHandler(_context, hasher.Object, refreshTokens.Object);

        await FluentActions.Invoking(() => handler.Handle(
                new ChangePasswordCommand(user.Id, "old-password", "NewPassword2026"),
                CancellationToken.None))
            .Should().ThrowAsync<InvalidOperationException>();

        using var verificationContext = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite(_connection)
            .Options);
        var persistedUser = await verificationContext.Users.SingleAsync(x => x.Id == user.Id);
        persistedUser.PasswordHash.Should().Be("old-hash");
    }

    public void Dispose()
    {
        _context.Dispose();
        _connection.Dispose();
    }
}

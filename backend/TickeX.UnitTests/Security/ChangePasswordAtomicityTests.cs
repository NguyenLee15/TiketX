using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Moq;
using TickeX.Application.Interfaces;
using TickeX.Application.Users.Commands;
using TickeX.Domain.Entities;
using TickeX.Infrastructure.Persistence;

namespace TickeX.UnitTests.Security;

public sealed class ChangePasswordAtomicityTests
{
    [Fact]
    public async Task Handle_ChangesPasswordAndRevokesAllActiveRefreshTokensInOneSave()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(connection).Options;
        await using var db = new ApplicationDbContext(options);
        await db.Database.EnsureCreatedAsync();

        var user = new User("Customer", "customer@example.com", "old-hash", "Customer");
        var activeToken = new RefreshToken(user.Id, "active-hash", DateTime.UtcNow.AddDays(1));
        var revokedToken = new RefreshToken(user.Id, "revoked-hash", DateTime.UtcNow.AddDays(1));
        revokedToken.Revoke();
        db.Users.Add(user);
        db.RefreshTokens.AddRange(activeToken, revokedToken);
        await db.SaveChangesAsync();

        var dbContext = new Mock<IApplicationDbContext>();
        dbContext.SetupGet(x => x.Users).Returns(db.Users);
        dbContext.SetupGet(x => x.RefreshTokens).Returns(db.RefreshTokens);
        dbContext.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .Returns<CancellationToken>(db.SaveChangesAsync);
        var passwordHasher = new Mock<IPasswordHasher>();
        passwordHasher.Setup(x => x.Verify("current-password", "old-hash")).Returns(true);
        passwordHasher.Setup(x => x.Hash("new-password")).Returns("new-hash");
        var handler = new ChangePasswordCommandHandler(dbContext.Object, passwordHasher.Object);

        var result = await handler.Handle(new ChangePasswordCommand(user.Id, "current-password", "new-password"), CancellationToken.None);

        result.Should().BeTrue();
        user.PasswordHash.Should().Be("new-hash");
        activeToken.RevokedAtUtc.Should().NotBeNull();
        revokedToken.RevokedAtUtc.Should().NotBeNull();
        dbContext.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}

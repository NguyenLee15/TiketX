using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using TickeX.Application.Auth;
using TickeX.Application.Auth.Commands;
using TickeX.Domain.Entities;

namespace TickeX.UnitTests.Security;

public sealed class RefreshTokenTests
{
    [Fact]
    public void GeneratedToken_IsHashedBeforePersistence()
    {
        var raw = RefreshTokenCrypto.Generate();
        raw.Should().NotBe(RefreshTokenCrypto.Hash(raw));
        RefreshTokenCrypto.Hash(raw).Should().HaveLength(64);
    }

    [Fact]
    public void Revoke_MakesTokenInactiveAndRecordsReplacement()
    {
        var token = new RefreshToken(Guid.NewGuid(), "hash", DateTime.UtcNow.AddDays(1));
        token.IsActive(DateTime.UtcNow).Should().BeTrue();
        token.Revoke("replacement");
        token.IsActive(DateTime.UtcNow).Should().BeFalse();
        token.ReplacedByTokenHash.Should().Be("replacement");
    }

    [Fact]
    public async Task RotateAsync_WhenConcurrentRotationAttempted_ThrowsDbUpdateConcurrencyException()
    {
        using var connection = new Microsoft.Data.Sqlite.SqliteConnection("DataSource=:memory:");
        connection.Open();

        var options = new Microsoft.EntityFrameworkCore.DbContextOptionsBuilder<TickeX.Infrastructure.Persistence.ApplicationDbContext>()
            .UseSqlite(connection)
            .Options;

        using (var setupCtx = new TickeX.Infrastructure.Persistence.ApplicationDbContext(options))
        {
            setupCtx.Database.EnsureCreated();
            var token = new RefreshToken(Guid.NewGuid(), "initial-hash", DateTime.UtcNow.AddDays(1));
            setupCtx.RefreshTokens.Add(token);
            await setupCtx.SaveChangesAsync();
        }

        using var ctx1 = new TickeX.Infrastructure.Persistence.ApplicationDbContext(options);
        using var ctx2 = new TickeX.Infrastructure.Persistence.ApplicationDbContext(options);

        var tokenInCtx1 = await ctx1.RefreshTokens.FirstAsync(x => x.TokenHash == "initial-hash");
        var tokenInCtx2 = await ctx2.RefreshTokens.FirstAsync(x => x.TokenHash == "initial-hash");

        var store1 = new TickeX.Infrastructure.Services.RefreshTokenStore(ctx1);
        var store2 = new TickeX.Infrastructure.Services.RefreshTokenStore(ctx2);

        var replacement1 = new RefreshToken(tokenInCtx1.UserId, "replacement-1", DateTime.UtcNow.AddDays(1));
        var replacement2 = new RefreshToken(tokenInCtx2.UserId, "replacement-2", DateTime.UtcNow.AddDays(1));

        // First rotation succeeds
        await store1.RotateAsync(tokenInCtx1, replacement1, CancellationToken.None);

        // Concurrent rotation on stale entity must throw DbUpdateConcurrencyException
        var act = () => store2.RotateAsync(tokenInCtx2, replacement2, CancellationToken.None);
        await act.Should().ThrowAsync<Microsoft.EntityFrameworkCore.DbUpdateConcurrencyException>();
    }

    [Fact]
    public async Task Handle_WhenConcurrentRotationFailsWithConcurrencyException_RevokesAllSessionsAndReturnsInvalid()
    {
        var mockTokens = new Moq.Mock<TickeX.Application.Interfaces.IRefreshTokenStore>();
        var mockDb = new Moq.Mock<TickeX.Application.Interfaces.IApplicationDbContext>();
        var mockJwt = new Moq.Mock<TickeX.Application.Interfaces.IJwtService>();

        var userId = Guid.NewGuid();
        var rawToken = "raw-refresh-token";
        var hash = RefreshTokenCrypto.Hash(rawToken);
        var currentToken = new RefreshToken(userId, hash, DateTime.UtcNow.AddDays(1));

        mockTokens.Setup(x => x.FindAsync(hash, Moq.It.IsAny<CancellationToken>()))
            .ReturnsAsync(currentToken);

        var user = new TickeX.Domain.Entities.User("Test User", "test@example.com", "hash", "Customer");
        // Using reflection or mock DbSet to return user
        using var connection = new Microsoft.Data.Sqlite.SqliteConnection("DataSource=:memory:");
        connection.Open();
        var options = new Microsoft.EntityFrameworkCore.DbContextOptionsBuilder<TickeX.Infrastructure.Persistence.ApplicationDbContext>()
            .UseSqlite(connection)
            .Options;

        using var dbContext = new TickeX.Infrastructure.Persistence.ApplicationDbContext(options);
        dbContext.Database.EnsureCreated();
        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();

        // Reload user from dbContext
        mockTokens.Setup(x => x.FindAsync(hash, Moq.It.IsAny<CancellationToken>()))
            .ReturnsAsync(new RefreshToken(user.Id, hash, DateTime.UtcNow.AddDays(1)));

        mockTokens.Setup(x => x.RotateAsync(Moq.It.IsAny<RefreshToken>(), Moq.It.IsAny<RefreshToken>(), Moq.It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Microsoft.EntityFrameworkCore.DbUpdateConcurrencyException("Concurrency conflict"));

        var handler = new RefreshTokenCommandHandler(mockTokens.Object, dbContext, mockJwt.Object);
        var result = await handler.Handle(new RefreshTokenCommand(rawToken), CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message.Should().Be("Phiên đăng nhập không hợp lệ hoặc đã hết hạn.");
        mockTokens.Verify(x => x.RevokeAllForUserAsync(user.Id, Moq.It.IsAny<CancellationToken>()), Moq.Times.Once);
    }
}

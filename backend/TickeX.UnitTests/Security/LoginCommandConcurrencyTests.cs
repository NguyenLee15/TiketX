using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TickeX.Domain.Entities;
using TickeX.Infrastructure.Persistence;
using Xunit;

namespace TickeX.UnitTests.Security;

public sealed class LoginCommandConcurrencyTests
{
    [Fact]
    public async Task ConcurrentFailedLoginUpdates_RejectStaleSnapshotInsteadOfOverwritingCounter()
    {
        var connectionString = $"Data Source={Guid.NewGuid():N};Mode=Memory;Cache=Shared";
        await using var anchor = new SqliteConnection(connectionString);
        await anchor.OpenAsync();

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite(connectionString)
            .Options;
        var user = new User("Customer", $"{Guid.NewGuid():N}@test.local", "test-hash");
        await using (var setup = new ApplicationDbContext(options))
        {
            await setup.Database.EnsureCreatedAsync();
            setup.Users.Add(user);
            await setup.SaveChangesAsync();
        }

        await using var firstRequest = new ApplicationDbContext(options);
        await using var concurrentRequest = new ApplicationDbContext(options);
        var firstSnapshot = await firstRequest.Users.SingleAsync(x => x.Id == user.Id);
        var staleSnapshot = await concurrentRequest.Users.SingleAsync(x => x.Id == user.Id);
        firstSnapshot.RecordFailedLogin();
        staleSnapshot.RecordFailedLogin();

        await firstRequest.SaveChangesAsync();
        var staleWrite = () => concurrentRequest.SaveChangesAsync();

        await staleWrite.Should().ThrowAsync<DbUpdateConcurrencyException>();
        await using var verification = new ApplicationDbContext(options);
        (await verification.Users.Where(x => x.Id == user.Id).Select(x => x.AccessFailedCount).SingleAsync())
            .Should().Be(1);
    }
}

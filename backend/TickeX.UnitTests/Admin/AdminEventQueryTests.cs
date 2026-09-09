using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Events.Queries;
using TickeX.Domain.Entities;
using TickeX.Infrastructure.Persistence;
using Xunit;

namespace TickeX.UnitTests.Admin;

public sealed class AdminEventQueryTests : IDisposable
{
    private readonly SqliteConnection _connection = new("DataSource=:memory:");
    private readonly ApplicationDbContext _context;

    public AdminEventQueryTests()
    {
        _connection.Open();
        _context = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite(_connection)
            .Options);
        _context.Database.EnsureCreated();
    }

    [Fact]
    public async Task AdminEvents_ShouldHideDeletedByDefault_AndIncludeThemOnRequest()
    {
        var active = new Event("Active", "Description", DateTime.UtcNow.AddDays(2), DateTime.UtcNow.AddDays(2).AddHours(2), "Location", "Venue", 10);
        var deleted = new Event("Deleted", "Description", DateTime.UtcNow.AddDays(3), DateTime.UtcNow.AddDays(3).AddHours(2), "Location", "Venue", 10);
        deleted.SoftDelete();
        _context.Events.AddRange(active, deleted);
        await _context.SaveChangesAsync();

        var handler = new GetAdminEventsQueryHandler(_context);

        var normal = await handler.Handle(new GetAdminEventsQuery(), CancellationToken.None);
        var history = await handler.Handle(new GetAdminEventsQuery(IncludeDeleted: true), CancellationToken.None);

        normal.Items.Should().ContainSingle(x => x.Id == active.Id);
        history.Items.Should().Contain(x => x.Id == deleted.Id && x.IsDeleted);
    }

    public void Dispose()
    {
        _context.Dispose();
        _connection.Dispose();
    }
}

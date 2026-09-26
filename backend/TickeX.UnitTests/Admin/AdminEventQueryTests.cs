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

    [Fact]
    public async Task AdminPagination_RejectsOverflowBeforeQuerying()
    {
        var events = () => new GetAdminEventsQueryHandler(_context).Handle(new GetAdminEventsQuery(Page: int.MaxValue), CancellationToken.None);
        var users = () => new TickeX.Application.Admin.Queries.GetUsersQueryHandler(_context).Handle(new TickeX.Application.Admin.Queries.GetUsersQuery(Page: int.MaxValue), CancellationToken.None);
        await events.Should().ThrowAsync<FluentValidation.ValidationException>();
        await users.Should().ThrowAsync<FluentValidation.ValidationException>();
    }

    [Fact]
    public async Task AdminEvents_ShouldProjectValidBase64Version_ForOptimisticLocking()
    {
        var ev = new Event("Concert", "Description", DateTime.UtcNow.AddDays(5), DateTime.UtcNow.AddDays(5).AddHours(3), "Location", "Venue", 100);
        _context.Events.Add(ev);
        await _context.SaveChangesAsync();

        var handler = new GetAdminEventsQueryHandler(_context);
        var result = await handler.Handle(new GetAdminEventsQuery(), CancellationToken.None);

        var item = result.Items.Should().ContainSingle(x => x.Id == ev.Id).Subject;
        item.Version.Should().NotBeNullOrWhiteSpace();
        item.Version.Should().Be(Convert.ToBase64String(ev.Version));
    }

    public void Dispose()
    {
        _context.Dispose();
        _connection.Dispose();
    }
}

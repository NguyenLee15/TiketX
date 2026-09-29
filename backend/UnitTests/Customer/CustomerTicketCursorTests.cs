using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Interfaces;
using TickeX.Domain.Entities;
using TickeX.Infrastructure.Persistence;
using TickeX.Infrastructure.Services;

namespace TickeX.UnitTests.Customer;

public sealed class CustomerTicketCursorTests : IDisposable
{
    private readonly SqliteConnection _connection = new("DataSource=:memory:");
    private readonly ApplicationDbContext _context;

    public CustomerTicketCursorTests()
    {
        _connection.Open();
        _context = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite(_connection).Options);
        _context.Database.EnsureCreated();
    }

    [Fact]
    public async Task CursorPagesAreStableAndDoNotRepeatTickets()
    {
        var user = new User("Customer", "cursor@test.local", "hash");
        var @event = new Event("Future", "Description", DateTime.UtcNow.AddDays(2), DateTime.UtcNow.AddDays(2).AddHours(2), "HCM", "Venue", 3);
        @event.GenerateSeatsMatrix(1, 3);
        _context.AddRange(user, @event);
        await _context.SaveChangesAsync();

        var seats = await _context.Seats.OrderBy(x => x.Number).ToListAsync();
        var tickets = seats.Select(seat =>
        {
            seat.Lock(user.Id);
            return new Ticket(@event.Id, seat.Id, user.Id, seat.Price);
        }).ToList();
        _context.Tickets.AddRange(tickets);
        await _context.SaveChangesAsync();
        for (var index = 0; index < tickets.Count; index++)
            _context.Entry(tickets[index]).Property(nameof(BaseEntity.CreatedAt)).CurrentValue = DateTime.UtcNow.AddMinutes(-index);
        await _context.SaveChangesAsync();

        var adapter = new CustomerTicketReadModelAdapter(_context, new UtcTimePolicy());
        var first = await adapter.GetForUserCursorAsync(user.Id, null, 2, null, CancellationToken.None);
        var second = await adapter.GetForUserCursorAsync(user.Id, first.NextCursor, 2, null, CancellationToken.None);

        first.Items.Should().HaveCount(2);
        first.HasMore.Should().BeTrue();
        second.Items.Should().ContainSingle();
        second.HasMore.Should().BeFalse();
        first.Items.Select(x => x.Id).Should().NotIntersectWith(second.Items.Select(x => x.Id));
    }

    [Fact]
    public async Task InvalidCursorIsRejected()
    {
        var adapter = new CustomerTicketReadModelAdapter(_context, new UtcTimePolicy());

        var action = () => adapter.GetForUserCursorAsync(Guid.NewGuid(), "not-a-cursor", 10, null, CancellationToken.None);

        await action.Should().ThrowAsync<ArgumentException>();
    }

    public void Dispose()
    {
        _context.Dispose();
        _connection.Dispose();
    }
}

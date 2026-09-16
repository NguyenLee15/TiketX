using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Events.Commands;
using TickeX.Domain.Entities;
using TickeX.Domain.Enums;
using TickeX.Infrastructure.Persistence;
using Xunit;

namespace TickeX.UnitTests.Admin;

public class EventConcurrencyAndAdminAuditTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly ApplicationDbContext _context;

    public EventConcurrencyAndAdminAuditTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite(_connection)
            .Options;

        _context = new ApplicationDbContext(options);
        _context.Database.EnsureCreated();
    }

    public void Dispose()
    {
        _context.Dispose();
        _connection.Dispose();
    }

    [Fact]
    public async Task UpdateEvent_WithMismatchedVersion_ReturnsConflict()
    {
        // Arrange
        var ev = new Event("Rock Fest", "Rock Concert", DateTime.UtcNow.AddDays(5), DateTime.UtcNow.AddDays(5).AddHours(3), "Hanoi", "National Stadium", 60);
        _context.Events.Add(ev);
        await _context.SaveChangesAsync();

        var staleVersion = Convert.ToBase64String(Guid.NewGuid().ToByteArray());
        var handler = new UpdateEventCommandHandler(_context);

        var command = new UpdateEventCommand(
            ev.Id,
            "Updated Rock Fest",
            ev.Description,
            ev.Date,
            ev.EndDate,
            ev.Location,
            ev.VenueName,
            ev.TotalSeats,
            ev.Category,
            ev.ImageUrl,
            ev.BannerUrl,
            ev.OrganizerName,
            ev.BasePrice,
            ev.Status,
            ev.RefundCutoffHours,
            ExpectedVersion: staleVersion
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(409);
        result.ErrorCode.Should().Be("EVENT_CONCURRENCY_CONFLICT");
    }

    [Fact]
    public async Task UpdateEvent_WithMatchingVersion_SucceedsAndRefreshesVersion()
    {
        // Arrange
        var ev = new Event("Jazz Night", "Jazz Live", DateTime.UtcNow.AddDays(5), DateTime.UtcNow.AddDays(5).AddHours(3), "HCMC", "Opera House", 60);
        _context.Events.Add(ev);
        await _context.SaveChangesAsync();

        var originalVersion = ev.Version;
        var validVersionStr = Convert.ToBase64String(originalVersion);
        var handler = new UpdateEventCommandHandler(_context);

        var command = new UpdateEventCommand(
            ev.Id,
            "Updated Jazz Night",
            ev.Description,
            ev.Date,
            ev.EndDate,
            ev.Location,
            ev.VenueName,
            ev.TotalSeats,
            ev.Category,
            ev.ImageUrl,
            ev.BannerUrl,
            ev.OrganizerName,
            ev.BasePrice,
            ev.Status,
            ev.RefundCutoffHours,
            ExpectedVersion: validVersionStr
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.StatusCode.Should().Be(200);

        var updatedEvent = await _context.Events.FindAsync(ev.Id);
        updatedEvent!.Title.Should().Be("Updated Jazz Night");
        updatedEvent.Version.Should().NotEqual(originalVersion);
    }

    [Fact]
    public async Task CreateEvent_ShouldRecordAuditLog_WithAdminDetails()
    {
        // Arrange
        var adminId = Guid.NewGuid();
        var adminEmail = "lead-admin@tickex.com";
        var clientIp = "192.168.1.100";
        var handler = new CreateEventCommandHandler(_context);

        var command = new CreateEventCommand(
            Title: "EDM Festival",
            Description: "Huge music festival",
            Date: DateTime.UtcNow.AddDays(10),
            EndDate: DateTime.UtcNow.AddDays(10).AddHours(5),
            Location: "Da Nang",
            VenueName: "Convention Center",
            TotalSeats: 60,
            Category: "Festival",
            ImageUrl: "https://example.com/image.jpg",
            AdminUserId: adminId,
            AdminEmail: adminEmail,
            IpAddress: clientIp
        );

        // Act
        var eventId = await handler.Handle(command, CancellationToken.None);

        // Assert
        eventId.Should().NotBeEmpty();

        var auditLog = await _context.AuditLogs.FirstOrDefaultAsync(a => a.EntityId == eventId.ToString());
        auditLog.Should().NotBeNull();
        auditLog!.Action.Should().Be("CREATE_EVENT");
        auditLog.UserId.Should().Be(adminId);
        auditLog.UserEmail.Should().Be(adminEmail);
        auditLog.IpAddress.Should().Be(clientIp);
    }
}

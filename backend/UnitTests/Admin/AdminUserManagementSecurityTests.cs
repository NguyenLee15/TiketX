using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Moq;
using TickeX.Application.Admin.Commands;
using TickeX.Application.Admin.Queries;
using TickeX.Application.Interfaces;
using TickeX.Domain.Entities;
using TickeX.Infrastructure.Persistence;
using Xunit;

namespace TickeX.UnitTests.Admin;

public class AdminUserManagementSecurityTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly ApplicationDbContext _context;
    private readonly Mock<IDistributedLockService> _mockLockService;

    public AdminUserManagementSecurityTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite(_connection)
            .Options;

        _context = new ApplicationDbContext(options);
        _context.Database.EnsureCreated();

        _mockLockService = new Mock<IDistributedLockService>();
        _mockLockService
            .Setup(l => l.AcquireLockAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TestDistributedLockLease());
    }

    private sealed class TestDistributedLockLease : IDistributedLockLease
    {
        public bool IsValid => true;
        public ValueTask DisposeAsync() => ValueTask.CompletedTask;
    }

    public void Dispose()
    {
        _context.Dispose();
        _connection.Dispose();
    }

    [Fact]
    public async Task ChangeRole_WhenDemotingLastAdmin_ShouldFailWithBadRequest()
    {
        // Arrange: Only 1 Admin in DB
        var admin = new User("Sole Admin", "admin@tickex.com", "hash", "Admin");
        _context.Users.Add(admin);
        await _context.SaveChangesAsync();

        var handler = new ChangeUserRoleCommandHandler(_context, _mockLockService.Object);
        var command = new ChangeUserRoleCommand(admin.Id, "Customer");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(400);
        result.ErrorCode.Should().Be("CANNOT_MODIFY_LAST_ADMIN");
        result.Message.Should().Contain("Không thể hạ quyền Quản trị viên duy nhất");

        // Verify role unchanged
        var userInDb = await _context.Users.FirstAsync(u => u.Id == admin.Id);
        userInDb.Role.Should().Be("Admin");
    }

    [Fact]
    public async Task ChangeRole_WhenAdminDemotesThemselves_ShouldFailWithBadRequest()
    {
        // Arrange: 2 Admins in DB
        var admin1 = new User("Admin One", "admin1@tickex.com", "hash", "Admin");
        var admin2 = new User("Admin Two", "admin2@tickex.com", "hash", "Admin");
        _context.Users.AddRange(admin1, admin2);
        await _context.SaveChangesAsync();

        var handler = new ChangeUserRoleCommandHandler(_context, _mockLockService.Object);
        var command = new ChangeUserRoleCommand(admin1.Id, "Customer", PerformedByAdminId: admin1.Id);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(400);
        result.ErrorCode.Should().Be("CANNOT_DEMOTE_SELF");
        result.Message.Should().Contain("Quản trị viên không thể tự hạ quyền");
    }

    [Fact]
    public async Task ChangeRole_WhenMultipleAdmins_ShouldSucceedAndRecordAuditLog()
    {
        // Arrange: 2 Admins
        var admin1 = new User("Admin One", "admin1@tickex.com", "hash", "Admin");
        var admin2 = new User("Admin Two", "admin2@tickex.com", "hash", "Admin");
        _context.Users.AddRange(admin1, admin2);
        await _context.SaveChangesAsync();

        var handler = new ChangeUserRoleCommandHandler(_context, _mockLockService.Object);
        var command = new ChangeUserRoleCommand(
            admin2.Id, 
            "Staff", 
            PerformedByAdminId: admin1.Id,
            AdminEmail: admin1.Email,
            IpAddress: "127.0.0.1"
        );

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.StatusCode.Should().Be(200);

        var updatedUser = await _context.Users.FirstAsync(u => u.Id == admin2.Id);
        updatedUser.Role.Should().Be("Staff");

        var audit = await _context.AuditLogs.FirstOrDefaultAsync(al => al.Action == "CHANGE_ROLE" && al.EntityId == admin2.Id.ToString());
        audit.Should().NotBeNull();
        audit!.BeforeState.Should().StartWith("Role=Admin;Version=");
        audit.AfterState.Should().StartWith("Role=Staff;Version=");
    }

    [Fact]
    public async Task BlockUser_WhenBlockingLastAdmin_ShouldFailWithBadRequest()
    {
        // Arrange: Only 1 Admin
        var admin = new User("Sole Admin", "admin@tickex.com", "hash", "Admin");
        _context.Users.Add(admin);
        await _context.SaveChangesAsync();

        var handler = new BlockUserCommandHandler(_context, _mockLockService.Object);
        var command = new BlockUserCommand(admin.Id, IsBlocked: true);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(400);
        result.ErrorCode.Should().Be("CANNOT_MODIFY_LAST_ADMIN");

        var userInDb = await _context.Users.FirstAsync(u => u.Id == admin.Id);
        userInDb.IsBlocked.Should().BeFalse();
    }

    [Fact]
    public async Task BlockUser_WhenAdminBlocksThemselves_ShouldFailWithBadRequest()
    {
        // Arrange: 2 Admins
        var admin1 = new User("Admin One", "admin1@tickex.com", "hash", "Admin");
        var admin2 = new User("Admin Two", "admin2@tickex.com", "hash", "Admin");
        _context.Users.AddRange(admin1, admin2);
        await _context.SaveChangesAsync();

        var handler = new BlockUserCommandHandler(_context, _mockLockService.Object);
        var command = new BlockUserCommand(admin1.Id, IsBlocked: true, PerformedByAdminId: admin1.Id);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(400);
        result.ErrorCode.Should().Be("CANNOT_BLOCK_SELF");
    }

    [Fact]
    public async Task GetUsers_ShouldSupportSearchRoleAndPagination()
    {
        // Arrange: 3 users with different roles
        var u1 = new User("Alice Admin", "alice@tickex.com", "hash", "Admin");
        var u2 = new User("Bob Staff", "bob@tickex.com", "hash", "Staff");
        var u3 = new User("Charlie Customer", "charlie@gmail.com", "hash", "Customer");
        _context.Users.AddRange(u1, u2, u3);
        await _context.SaveChangesAsync();

        var handler = new GetUsersQueryHandler(_context);

        // Act 1: Search by email
        var resSearch = await handler.Handle(new GetUsersQuery(Search: "charlie"), CancellationToken.None);
        resSearch.TotalCount.Should().Be(1);
        resSearch.Items[0].Email.Should().Be("charlie@gmail.com");

        // Act 2: Filter by role
        var resRole = await handler.Handle(new GetUsersQuery(Role: "Staff"), CancellationToken.None);
        resRole.TotalCount.Should().Be(1);
        resRole.Items[0].Role.Should().Be("Staff");

        // Act 3: Pagination
        var resPage = await handler.Handle(new GetUsersQuery(Page: 1, PageSize: 2), CancellationToken.None);
        resPage.TotalCount.Should().Be(3);
        resPage.TotalPages.Should().Be(2);
        resPage.Items.Should().HaveCount(2);
    }

    [Fact]
    public async Task ChangeRole_WithStaleExpectedVersion_ShouldReturnConflictWithoutMutation()
    {
        var admin = new User("Admin One", "admin1@tickex.com", "hash", "Admin");
        var target = new User("Target", "target@tickex.com", "hash", "Staff");
        _context.Users.AddRange(admin, target);
        await _context.SaveChangesAsync();

        var staleVersion = target.Version.ToArray();
        target.ChangeRole("Customer");
        await _context.SaveChangesAsync();

        var handler = new ChangeUserRoleCommandHandler(_context, _mockLockService.Object);
        var result = await handler.Handle(
            new ChangeUserRoleCommand(target.Id, "Admin", admin.Id, admin.Email, "127.0.0.1", staleVersion),
            CancellationToken.None);

        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(409);
        result.ErrorCode.Should().Be("CONCURRENCY_CONFLICT");
        (await _context.Users.FirstAsync(u => u.Id == target.Id)).Role.Should().Be("Customer");
    }

    [Fact]
    public async Task Block_WithStaleExpectedVersion_ShouldReturnConflictWithoutMutation()
    {
        var admin = new User("Admin One", "admin1@tickex.com", "hash", "Admin");
        var target = new User("Target", "target@tickex.com", "hash", "Customer");
        _context.Users.AddRange(admin, target);
        await _context.SaveChangesAsync();

        var staleVersion = target.Version.ToArray();
        target.UpdateProfile("Updated Target", "", "");
        target.ChangeRole("Staff");
        await _context.SaveChangesAsync();

        var handler = new BlockUserCommandHandler(_context, _mockLockService.Object);
        var result = await handler.Handle(
            new BlockUserCommand(target.Id, true, admin.Id, admin.Email, "127.0.0.1", staleVersion),
            CancellationToken.None);

        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(409);
        result.ErrorCode.Should().Be("CONCURRENCY_CONFLICT");
        (await _context.Users.FirstAsync(u => u.Id == target.Id)).IsBlocked.Should().BeFalse();
    }

    [Fact]
    public async Task GetUsers_ShouldReturnBase64Version()
    {
        var user = new User("Versioned User", "versioned@tickex.com", "hash");
        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        var result = await new GetUsersQueryHandler(_context)
            .Handle(new GetUsersQuery(Search: "versioned"), CancellationToken.None);

        result.Items.Should().ContainSingle();
        result.Items[0].Version.Should().Be(Convert.ToBase64String(user.Version));
    }
}

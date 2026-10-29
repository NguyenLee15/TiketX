using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using System.Text;
using System.Text.Json;
using TickeX.Application.Events.Queries;
using TickeX.Application.Interfaces;
using TickeX.Application.Seats.Commands;
using TickeX.Application.Tickets.Commands;
using TickeX.Domain.Entities;
using TickeX.Domain.Enums;
using TickeX.Infrastructure.Persistence;
using TickeX.Infrastructure.Services;
using TickeX.Application.Seats;
using TickeX.Application.Payments.Commands;
using TickeX.Application.Users.Commands;
using TickeX.Application.Users.Queries;
using Xunit;

namespace TickeX.UnitTests.Customer;

public sealed class CustomerCoreBehaviorTests : IDisposable
{
    private readonly SqliteConnection _connection = new("DataSource=:memory:");
    private readonly ApplicationDbContext _context;

    public CustomerCoreBehaviorTests()
    {
        _connection.Open();
        _context = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite(_connection)
            .Options);
        _context.Database.EnsureCreated();
    }

    [Fact]
    public async Task PublicCatalog_ExcludesDeletedAndAlreadyStartedEvents()
    {
        var future = CreateEvent("Future", DateTime.UtcNow.AddDays(2));
        var deleted = CreateEvent("Deleted", DateTime.UtcNow.AddDays(3));
        deleted.SoftDelete();
        var started = CreateEvent("Started", DateTime.UtcNow.AddHours(-1));
        _context.Events.AddRange(future, deleted, started);
        await _context.SaveChangesAsync();

        var catalog = new CustomerEventCatalogAdapter(_context, new UtcTimePolicy());
        var result = await new GetEventsQueryHandler(catalog)
            .Handle(new GetEventsQuery(), CancellationToken.None);

        result.Items.Select(x => x.Title).Should().Equal("Future");
    }

    [Fact]
    public async Task PublicCatalogTreatsAllCategoryCaseInsensitively()
    {
        _context.Events.Add(CreateEvent("Future", DateTime.UtcNow.AddDays(2)));
        await _context.SaveChangesAsync();

        var catalog = new CustomerEventCatalogAdapter(_context, new UtcTimePolicy());
        var result = await catalog.SearchAsync(new GetEventsQuery(Category: "all"), CancellationToken.None);

        result.Items.Should().ContainSingle();
    }

    [Fact]
    public async Task PublicCatalogCursorResponseDoesNotPretendToHaveOffsetTotals()
    {
        var first = CreateEvent("First", DateTime.UtcNow.AddDays(2));
        var second = CreateEvent("Second", DateTime.UtcNow.AddDays(3));
        _context.Events.AddRange(first, second);
        await _context.SaveChangesAsync();

        var catalog = new CustomerEventCatalogAdapter(_context, new UtcTimePolicy());
        var cursor = Convert.ToBase64String(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new
        {
            SortBy = "date_asc",
            Date = first.Date,
            Price = first.BasePrice,
            Id = first.Id
        }))).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        var cursorResult = await catalog.SearchAsync(new GetEventsQuery(PageSize: 1, Cursor: cursor), CancellationToken.None);

        cursorResult.PaginationMode.Should().Be("cursor");
        cursorResult.TotalCount.Should().BeNull();
        cursorResult.TotalPages.Should().BeNull();
        cursorResult.HasMore.Should().BeFalse();
    }

    [Fact]
    public async Task SearchAsync_WhenCursorIsInvalid_ThrowsArgumentException()
    {
        var catalog = new CustomerEventCatalogAdapter(_context, new UtcTimePolicy());
        var act = () => catalog.SearchAsync(new GetEventsQuery(Cursor: "invalid-cursor-format-!@#$"), CancellationToken.None);
        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*Cursor không hợp lệ*");
    }

    [Fact]
    public async Task PublicDetail_DoesNotExposeDeletedOrAlreadyStartedEvents()
    {
        var deleted = CreateEvent("Deleted", DateTime.UtcNow.AddDays(2));
        deleted.SoftDelete();
        var started = CreateEvent("Started", DateTime.UtcNow.AddHours(-1));
        _context.Events.AddRange(deleted, started);
        await _context.SaveChangesAsync();

        var handler = new GetEventWithSeatsQueryHandler(_context);

        (await handler.Handle(new GetEventWithSeatsQuery(deleted.Id), CancellationToken.None)).Should().BeNull();
        (await handler.Handle(new GetEventWithSeatsQuery(started.Id), CancellationToken.None)).Should().BeNull();
    }

    [Fact]
    public async Task LockSeat_WithStaleClientVersion_IsRejectedWithoutMutation()
    {
        var user = new User("Customer", $"{Guid.NewGuid():N}@test.local", "hash");
        var userId = user.Id;
        _context.Users.Add(user);
        var @event = CreateEvent("Future", DateTime.UtcNow.AddDays(2));
        @event.GenerateSeatsMatrix(1, 1);
        _context.Events.Add(@event);
        await _context.SaveChangesAsync();
        var seat = await _context.Seats.SingleAsync();

        var lockService = new Mock<IDistributedLockService>();
        lockService.Setup(x => x.AcquireLockAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TestDistributedLockLease());
        var notifications = new Mock<ISeatNotificationService>();
        var scheduler = new Mock<IReservationExpiryScheduler>();
        var handler = new LockSeatCommandHandler(new ReservationOperations(
            _context, lockService.Object, notifications.Object, scheduler.Object,
            Options.Create(new ReservationOptions()), NullLogger<ReservationOperations>.Instance));

        var result = await handler.Handle(
            new LockSeatCommand(@event.Id, seat.Id, userId, Guid.NewGuid().ToByteArray()),
            CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Code.Should().Be("SEAT_VERSION_CONFLICT");
        (await _context.Seats.AsNoTracking().SingleAsync()).Status.Should().Be(SeatStatus.Available);
        (await _context.Tickets.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task LockSeat_WhenRequiredDistributedLockThrows_FailsClosedWithoutMutation()
    {
        var user = new User("Customer", $"{Guid.NewGuid():N}@test.local", "hash");
        var userId = user.Id;
        _context.Users.Add(user);
        var @event = CreateEvent("Future", DateTime.UtcNow.AddDays(2));
        @event.GenerateSeatsMatrix(1, 1);
        _context.Events.Add(@event);
        await _context.SaveChangesAsync();
        var seat = await _context.Seats.SingleAsync();

        var lockService = new Mock<IDistributedLockService>();
        lockService.Setup(x => x.AcquireLockAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("Redis unavailable"));
        var notifications = new Mock<ISeatNotificationService>();
        var scheduler = new Mock<IReservationExpiryScheduler>();
        var handler = new LockSeatCommandHandler(new ReservationOperations(
            _context, lockService.Object, notifications.Object, scheduler.Object,
            Options.Create(new ReservationOptions()), NullLogger<ReservationOperations>.Instance));

        var result = await handler.Handle(
            new LockSeatCommand(@event.Id, seat.Id, userId, seat.Version),
            CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Code.Should().Be("RESERVATION_LOCK_UNAVAILABLE");
        (await _context.Seats.AsNoTracking().SingleAsync()).Status.Should().Be(SeatStatus.Available);
        (await _context.Tickets.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task LockSeat_WhenPostCommitIntegrationsFail_ReturnsCommittedSuccess()
    {
        var user = new User("Customer", $"{Guid.NewGuid():N}@test.local", "hash");
        var @event = CreateEvent("Future", DateTime.UtcNow.AddDays(2));
        @event.GenerateSeatsMatrix(1, 1);
        _context.AddRange(user, @event);
        await _context.SaveChangesAsync();
        var seat = await _context.Seats.SingleAsync();
        var locks = new Mock<IDistributedLockService>();
        locks.Setup(x => x.AcquireLockAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>())).ReturnsAsync(new TestDistributedLockLease());
        var scheduler = new Mock<IReservationExpiryScheduler>();
        scheduler.Setup(x => x.Schedule(It.IsAny<Guid>(), It.IsAny<TimeSpan>())).Throws(new InvalidOperationException("Hangfire down"));
        var notifications = new Mock<ISeatNotificationService>();
        notifications.Setup(x => x.NotifySeatStatusChanged(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<DateTime?>()))
            .ThrowsAsync(new InvalidOperationException("SignalR down"));
        var operations = new ReservationOperations(_context, locks.Object, notifications.Object, scheduler.Object,
            Options.Create(new ReservationOptions()), NullLogger<ReservationOperations>.Instance);

        var result = await operations.ReserveAsync(@event.Id, seat.Id, user.Id, seat.Version, CancellationToken.None);

        result.Success.Should().BeTrue();
        (await _context.Tickets.CountAsync()).Should().Be(1);
        (await _context.Seats.AsNoTracking().SingleAsync()).Status.Should().Be(SeatStatus.Locked);
        notifications.Verify(x => x.NotifyOwnSeatLockChanged(
            user.Id, @event.Id, seat.Id, "Locked", It.IsAny<string>(), It.IsAny<DateTime>()), Times.Once);
    }

    [Fact]
    public async Task ReservationOperations_ReserveAndRelease_UsesNormalizedLockKeyFormatMatchingPaymentWebhook()
    {
        var user = new User("Customer", $"{Guid.NewGuid():N}@test.local", "hash");
        var @event = CreateEvent("LockKeyFormatConcert", DateTime.UtcNow.AddDays(2));
        @event.GenerateSeatsMatrix(1, 1);
        _context.AddRange(user, @event);
        await _context.SaveChangesAsync();

        var seat = await _context.Seats.SingleAsync();
        var locks = new Mock<IDistributedLockService>();
        locks.Setup(x => x.AcquireLockAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TestDistributedLockLease());

        var operations = new ReservationOperations(
            _context, locks.Object, Mock.Of<ISeatNotificationService>(), Mock.Of<IReservationExpiryScheduler>(),
            Options.Create(new ReservationOptions()), NullLogger<ReservationOperations>.Instance);

        // Act 1: Reserve
        var reserveResult = await operations.ReserveAsync(@event.Id, seat.Id, user.Id, seat.Version, CancellationToken.None);
        reserveResult.Success.Should().BeTrue();

        // Assert 1: Lock key format must be seat:lock:{seatId:N} (exact 32-hex character lowercase, no dashes)
        var expectedSeatLockKey = $"seat:lock:{seat.Id:N}";
        locks.Verify(x => x.AcquireLockAsync(expectedSeatLockKey, It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()), Times.Once);

        // Act 2: Release
        var releaseResult = await operations.ReleaseAsync(reserveResult.TicketId!.Value, user.Id, "CustomerCancelled", CancellationToken.None);
        releaseResult.Success.Should().BeTrue();

        // Assert 2: Release lock key format must also be seat:lock:{seatId:N}
        locks.Verify(x => x.AcquireLockAsync(expectedSeatLockKey, It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()), Times.Exactly(2));
    }

    [Fact]
    public async Task LockSeat_WhenPostCommitCacheCancellationOccurs_ReturnsCommittedSuccess()
    {
        var user = new User("Customer", $"{Guid.NewGuid():N}@test.local", "hash");
        var @event = CreateEvent("Future", DateTime.UtcNow.AddDays(2));
        @event.GenerateSeatsMatrix(1, 1);
        _context.AddRange(user, @event);
        await _context.SaveChangesAsync();
        var seat = await _context.Seats.SingleAsync();

        using var requestCancellation = new CancellationTokenSource();
        var cache = new Mock<ICustomerEventCatalogCache>();
        cache.Setup(x => x.InvalidateAsync(It.IsAny<CancellationToken>()))
            .Returns<CancellationToken>(token => token == requestCancellation.Token
                ? Task.FromException(new OperationCanceledException(token))
                : Task.CompletedTask);
        var locks = new Mock<IDistributedLockService>();
        locks.Setup(x => x.AcquireLockAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TestDistributedLockLease());

        var operations = new ReservationOperations(_context, locks.Object, Mock.Of<ISeatNotificationService>(),
            Mock.Of<IReservationExpiryScheduler>(), Options.Create(new ReservationOptions()),
            NullLogger<ReservationOperations>.Instance, catalogCache: cache.Object);

        var result = await operations.ReserveAsync(@event.Id, seat.Id, user.Id, seat.Version, requestCancellation.Token);

        result.Success.Should().BeTrue();
        (await _context.Tickets.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task CustomerRefund_QueuesOutboxAndLeavesSoldSeatUnavailable()
    {
        var user = new User("Customer", $"{Guid.NewGuid():N}@test.local", "hash");
        var userId = user.Id;
        _context.Users.Add(user);
        var @event = CreateEvent("Future", DateTime.UtcNow.AddDays(4));
        @event.GenerateSeatsMatrix(1, 1);
        _context.Events.Add(@event);
        await _context.SaveChangesAsync();
        var seat = await _context.Seats.SingleAsync();
        seat.Lock(userId);
        seat.MarkAsSold();
        var ticket = new Ticket(@event.Id, seat.Id, userId, seat.Price);
        ticket.MarkAsPaid();
        _context.Tickets.Add(ticket);
        _context.RefundBankAccounts.Add(new RefundBankAccount(userId, "protected-payload", "6789"));
        await _context.SaveChangesAsync();

        var lockService = new Mock<IDistributedLockService>();
        lockService.Setup(x => x.AcquireLockAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TestDistributedLockLease());
        var handler = new RefundTicketCommandHandler(_context, lockService.Object, new RefundRequestPort(_context));

        var result = await handler.Handle(
            new RefundTicketCommand(ticket.Id, userId, "Changed plans", "customer@test.local", "127.0.0.1"),
            CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Code.Should().Be("REFUND_PENDING");
        (await _context.Tickets.AsNoTracking().SingleAsync()).Status.Should().Be(TicketStatus.RefundPending);
        (await _context.Seats.AsNoTracking().SingleAsync()).Status.Should().Be(SeatStatus.Sold);
        (await _context.RefundRequests.CountAsync()).Should().Be(1);
        var audit = await _context.AuditLogs.AsNoTracking().SingleAsync();
        audit.UserEmail.Should().Be("customer@test.local");
        audit.IpAddress.Should().Be("127.0.0.1");
        audit.AfterState.Should().Contain("Changed plans");

        var repeated = await handler.Handle(new RefundTicketCommand(ticket.Id, userId), CancellationToken.None);
        repeated.Success.Should().BeTrue();
        repeated.Code.Should().Be("REFUND_PENDING");
        (await _context.RefundRequests.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task CustomerRefund_WithoutRefundDestination_DoesNotChangeTicketOrCreateOutbox()
    {
        var user = new User("Customer", $"{Guid.NewGuid():N}@test.local", "hash");
        _context.Users.Add(user);
        var @event = CreateEvent("Future", DateTime.UtcNow.AddDays(4));
        @event.GenerateSeatsMatrix(1, 1);
        _context.Events.Add(@event);
        await _context.SaveChangesAsync();
        var seat = await _context.Seats.SingleAsync();
        seat.Lock(user.Id);
        seat.MarkAsSold();
        var ticket = new Ticket(@event.Id, seat.Id, user.Id, seat.Price);
        ticket.MarkAsPaid();
        _context.Tickets.Add(ticket);
        await _context.SaveChangesAsync();

        var locks = new Mock<IDistributedLockService>();
        locks.Setup(x => x.AcquireLockAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TestDistributedLockLease());
        var handler = new RefundTicketCommandHandler(_context, locks.Object, new RefundRequestPort(_context));

        var result = await handler.Handle(new RefundTicketCommand(ticket.Id, user.Id), CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Code.Should().Be("REFUND_DESTINATION_REQUIRED");
        (await _context.Tickets.AsNoTracking().SingleAsync()).Status.Should().Be(TicketStatus.Paid);
        (await _context.RefundRequests.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task SavingRefundDestination_SnapshotsWaitingRefundAndProfileMasksAccountNumber()
    {
        var user = new User("Customer", $"{Guid.NewGuid():N}@test.local", "hash");
        _context.Users.Add(user);
        var @event = CreateEvent("Cancelled", DateTime.UtcNow.AddDays(4));
        @event.GenerateSeatsMatrix(1, 1);
        _context.Events.Add(@event);
        await _context.SaveChangesAsync();
        var seat = await _context.Seats.SingleAsync();
        var ticket = new Ticket(@event.Id, seat.Id, user.Id, seat.Price);
        ticket.MarkAsPaid();
        ticket.MarkRefundPending();
        _context.Tickets.Add(ticket);
        var waiting = new RefundRequest(@event.Id, ticket.Id, ticket.Price, $"event-cancel:{ticket.Id:N}");
        waiting.WaitForDestination();
        _context.RefundRequests.Add(waiting);
        await _context.SaveChangesAsync();

        var protector = new Mock<IRefundBankAccountProtector>();
        protector.Setup(x => x.Protect(It.IsAny<RefundBankAccountDetails>())).Returns("encrypted-payload");
        protector.Setup(x => x.Unprotect("encrypted-payload"))
            .Returns(new RefundBankAccountDetails("970415", "CUSTOMER NAME", "123456789012"));
        var saved = await new SaveRefundBankAccountCommandHandler(_context, protector.Object)
            .Handle(new SaveRefundBankAccountCommand(user.Id, "970415", "Customer Name", "123456789012"), CancellationToken.None);

        saved.Should().BeTrue();
        var storedRefund = await _context.RefundRequests.AsNoTracking().SingleAsync();
        storedRefund.Status.Should().Be("Pending");
        storedRefund.EncryptedDestinationSnapshot.Should().Be("encrypted-payload");
        var profile = await new GetUserProfileQueryHandler(_context, protector.Object)
            .Handle(new GetUserProfileQuery(user.Id), CancellationToken.None);
        profile!.RefundBankAccountMasked.Should().Be("•••• 9012");
    }

    [Theory]
    [InlineData(int.MaxValue, 50)]
    [InlineData(1, 51)]
    [InlineData(0, 10)]
    public async Task CustomerTicketPagination_RejectsOutOfRangeBeforeDatabaseQuery(int page, int pageSize)
    {
        var readModel = new CustomerTicketReadModelAdapter(_context, new VietnamTimePolicy());

        var act = () => readModel.GetForUserAsync(Guid.NewGuid(), page, pageSize, cancellationToken: CancellationToken.None);

        await act.Should().ThrowAsync<ArgumentOutOfRangeException>();
    }

    [Fact]
    public async Task Release_WhenRealtimeNotificationFails_ReturnsCommittedSuccess()
    {
        var user = new User("Customer", $"{Guid.NewGuid():N}@test.local", "hash");
        var @event = CreateEvent("Future", DateTime.UtcNow.AddDays(2));
        @event.GenerateSeatsMatrix(1, 1);
        _context.AddRange(user, @event);
        await _context.SaveChangesAsync();
        var seat = await _context.Seats.SingleAsync();
        seat.Lock(user.Id);
        var ticket = new Ticket(@event.Id, seat.Id, user.Id, seat.Price);
        _context.Tickets.Add(ticket);
        await _context.SaveChangesAsync();

        var locks = new Mock<IDistributedLockService>();
        locks.Setup(x => x.AcquireLockAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>())).ReturnsAsync(new TestDistributedLockLease());
        var notifications = new Mock<ISeatNotificationService>();
        notifications.Setup(x => x.NotifySeatStatusChanged(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<DateTime?>()))
            .ThrowsAsync(new InvalidOperationException("SignalR down"));
        var operations = new ReservationOperations(_context, locks.Object, notifications.Object,
            Mock.Of<IReservationExpiryScheduler>(), Options.Create(new ReservationOptions()), NullLogger<ReservationOperations>.Instance);

        var result = await operations.ReleaseAsync(ticket.Id, user.Id, "cancel", CancellationToken.None);

        result.Success.Should().BeTrue();
        (await _context.Tickets.AsNoTracking().SingleAsync()).Status.Should().Be(TicketStatus.Cancelled);
        (await _context.Seats.AsNoTracking().SingleAsync()).Status.Should().Be(SeatStatus.Available);
    }

    [Fact]
    public async Task CustomerRefund_WhenTicketDoesNotExist_ReturnsTypedNotFoundCode()
    {
        var locks = new Mock<IDistributedLockService>();
        locks.Setup(x => x.AcquireLockAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>())).ReturnsAsync(new TestDistributedLockLease());
        var handler = new RefundTicketCommandHandler(_context, locks.Object, new RefundRequestPort(_context));

        var result = await handler.Handle(new RefundTicketCommand(Guid.NewGuid(), Guid.NewGuid()), CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Code.Should().Be("REFUND_TICKET_NOT_FOUND");
    }

    [Fact]
    public async Task Ticket_UniqueFilteredIndex_PreventsDoubleBookingOnSameSeat()
    {
        var user1 = new User("Customer1", "c1@test.local", "hash");
        var user2 = new User("Customer2", "c2@test.local", "hash");
        var @event = CreateEvent("Concert", DateTime.UtcNow.AddDays(2));
        @event.GenerateSeatsMatrix(1, 1);
        _context.AddRange(user1, user2, @event);
        await _context.SaveChangesAsync();

        var seat = await _context.Seats.SingleAsync();

        // First ticket: Pending (active)
        var ticket1 = new Ticket(@event.Id, seat.Id, user1.Id, seat.Price);
        _context.Tickets.Add(ticket1);
        await _context.SaveChangesAsync();

        // Second concurrent ticket on the same seat: Also Pending
        var ticket2 = new Ticket(@event.Id, seat.Id, user2.Id, seat.Price);
        _context.Tickets.Add(ticket2);

        // Act & Assert: Must throw DbUpdateException due to UNIQUE filtered index
        var act = async () => await _context.SaveChangesAsync();
        await act.Should().ThrowAsync<DbUpdateException>();
    }

    [Fact]
    public async Task GetForUserAsync_WithPagination_ReturnsClampedPageItems()
    {
        var user = new User("Customer", "pager@test.local", "hash");
        var @event = CreateEvent("Concert", DateTime.UtcNow.AddDays(2));
        @event.GenerateSeatsMatrix(2, 3); // 6 seats
        _context.AddRange(user, @event);
        await _context.SaveChangesAsync();

        var seats = await _context.Seats.ToListAsync();
        foreach (var s in seats)
        {
            var t = new Ticket(@event.Id, s.Id, user.Id, s.Price);
            t.Cancel();
            _context.Tickets.Add(t);
        }
        await _context.SaveChangesAsync();

        var adapter = new CustomerTicketReadModelAdapter(_context, new UtcTimePolicy());

        // Page 1 with pageSize 2 -> 2 items
        var page1 = await adapter.GetForUserAsync(user.Id, page: 1, pageSize: 2);
        page1.Should().HaveCount(2);

        // Page 2 with pageSize 2 -> 2 items
        var page2 = await adapter.GetForUserAsync(user.Id, page: 2, pageSize: 2);
        page2.Should().HaveCount(2);

        // Page 1 and Page 2 items must not overlap
        page1.Select(x => x.Id).Should().NotIntersectWith(page2.Select(x => x.Id));
    }

    [Fact]
    public async Task LockSeat_WhenUserHasExpiredPendingTickets_DoesNotCountAgainstHoldLimit_ShouldSucceed()
    {
        var user = new User("Customer", "limit_expired@test.local", "hash");
        var userId = user.Id;
        var @event = CreateEvent("Concert", DateTime.UtcNow.AddDays(2));
        @event.GenerateSeatsMatrix(1, 5); // 5 seats
        _context.AddRange(user, @event);
        await _context.SaveChangesAsync();

        var seats = await _context.Seats.OrderBy(s => s.Row).ThenBy(s => s.Number).ToListAsync();

        // Add 4 expired pending tickets for this user (Max pending limit is 4)
        for (var i = 0; i < 4; i++)
        {
            var oldTicket = new Ticket(@event.Id, seats[i].Id, userId, seats[i].Price);
            _context.Tickets.Add(oldTicket);
            _context.Entry(oldTicket).Property(nameof(BaseEntity.CreatedAt)).CurrentValue = DateTime.UtcNow.AddMinutes(-30);
        }
        await _context.SaveChangesAsync();

        var lockService = new Mock<IDistributedLockService>();
        lockService.Setup(x => x.AcquireLockAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TestDistributedLockLease());
        var notifications = new Mock<ISeatNotificationService>();
        var scheduler = new Mock<IReservationExpiryScheduler>();
        var options = new ReservationOptions { HoldMinutes = 5, MaximumPendingSeatsPerEvent = 4 };
        var handler = new LockSeatCommandHandler(new ReservationOperations(
            _context, lockService.Object, notifications.Object, scheduler.Object,
            Options.Create(options), NullLogger<ReservationOperations>.Instance));

        var targetSeat = seats[4];
        var result = await handler.Handle(
            new LockSeatCommand(@event.Id, targetSeat.Id, userId, targetSeat.Version),
            CancellationToken.None);

        result.Success.Should().BeTrue();
        var updatedSeat = await _context.Seats.AsNoTracking().SingleAsync(s => s.Id == targetSeat.Id);
        updatedSeat.Status.Should().Be(SeatStatus.Locked);
        updatedSeat.LockedByUserId.Should().Be(userId);
    }

    [Fact]
    public async Task CreatePaymentLink_WhenHoldHasExpired_RejectsWithReservationExpired()
    {
        var user = new User("Customer", "expired_hold@test.local", "hash");
        var @event = CreateEvent("ExpiredHoldEvent", DateTime.UtcNow.AddDays(2));
        @event.GenerateSeatsMatrix(1, 1);
        _context.AddRange(user, @event);
        await _context.SaveChangesAsync();

        var seat = await _context.Seats.SingleAsync();
        seat.Lock(user.Id);
        var ticket = new Ticket(@event.Id, seat.Id, user.Id, seat.Price);
        _context.Tickets.Add(ticket);
        _context.Entry(ticket).Property(nameof(BaseEntity.CreatedAt)).CurrentValue = DateTime.UtcNow.AddMinutes(-15);
        await _context.SaveChangesAsync();

        var payos = new Mock<IPayOSService>();
        var mediator = new Mock<MediatR.IMediator>();
        var environment = new Mock<IHostEnvironment>();
        environment.SetupGet(x => x.EnvironmentName).Returns(Environments.Production);
        var settings = new Dictionary<string, string?>
        {
            ["PayOS:ReturnUrl"] = "https://tickex.local/payment-result",
            ["PayOS:CancelUrl"] = "https://tickex.local/my-tickets",
            ["PayOS:ClientId"] = "configured"
        };
        var operations = new CustomerCheckoutOperations(
            _context, payos.Object, mediator.Object,
            new ConfigurationBuilder().AddInMemoryCollection(settings).Build(),
            environment.Object, NullLogger<CustomerCheckoutOperations>.Instance);

        var result = await operations.CreatePaymentLinkAsync(ticket.Id, user.Id, CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Code.Should().Be("RESERVATION_EXPIRED");
        payos.Verify(x => x.CreatePaymentLink(It.IsAny<long>(), It.IsAny<int>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public void BcryptPasswordHasher_WorkFactor12_ProducesVerifiableHash()
    {
        var hasher = new BcryptPasswordHasher();
        const string rawPassword = "StrongPassword@123!";

        var hash = hasher.Hash(rawPassword);

        hash.Should().StartWith("$2a$12$");
        hasher.Verify(rawPassword, hash).Should().BeTrue();
        hasher.Verify("WrongPassword", hash).Should().BeFalse();
    }

    [Fact]
    public async Task ProcessPayment_OrphanedPaid_CreatesRefundRequestAndAuditLog()
    {
        var user = new User("Customer", "orphan@test.local", "hash");
        var @event = CreateEvent("Concert", DateTime.UtcNow.AddDays(2));
        @event.GenerateSeatsMatrix(1, 1);
        _context.AddRange(user, @event);
        await _context.SaveChangesAsync();

        var seat = await _context.Seats.SingleAsync();
        seat.Lock(user.Id);
        var ticket = new Ticket(@event.Id, seat.Id, user.Id, seat.Price);
        _context.Tickets.Add(ticket);
        await _context.SaveChangesAsync();

        // Expire the ticket to simulate orphaned state (Cancelled, not Pending)
        ticket.Cancel();
        seat.Release();
        await _context.SaveChangesAsync();

        var lockService = new Mock<IDistributedLockService>();
        lockService.Setup(x => x.AcquireLockAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TestDistributedLockLease());
        var notifications = new Mock<ISeatNotificationService>();
        var outbox = new Mock<INotificationOutboxPort>();
        var ticketSecurity = new Mock<ITicketSecurityService>();

        var handler = new ProcessPaymentCommandHandler(
            _context, outbox.Object, notifications.Object, lockService.Object,
            ticketSecurity.Object, NullLogger<ProcessPaymentCommandHandler>.Instance);

        var webhookData = new PayOSWebhookData
        {
            OrderCode = ticket.OrderCode,
            Amount = ticket.Price,
            Success = true,
            Reference = "payos-ref-123",
            Code = "00"
        };

        var result = await handler.Handle(new ProcessPaymentCommand(webhookData), CancellationToken.None);

        result.Should().BeTrue("orphaned payment should be acknowledged to stop webhook retries");
        (await _context.RefundRequests.CountAsync()).Should().Be(1);
        var refundReq = await _context.RefundRequests.SingleAsync();
        refundReq.TicketId.Should().Be(ticket.Id);
        refundReq.Amount.Should().Be(ticket.Price);
        (await _context.AuditLogs.AnyAsync(a => a.Action == "ORPHANED_PAYMENT_DETECTED")).Should().BeTrue();
    }

    [Fact]
    public async Task ProcessPayment_WhenPendingTicketExceedsHoldDuration_CancelsTicketReleasesSeatAndMarksOrphaned()
    {
        var user = new User("Customer", "expired_webhook@test.local", "hash");
        var @event = CreateEvent("LateWebhookConcert", DateTime.UtcNow.AddDays(2));
        @event.GenerateSeatsMatrix(1, 1);
        _context.AddRange(user, @event);
        await _context.SaveChangesAsync();

        var seat = await _context.Seats.SingleAsync();
        seat.Lock(user.Id);
        var ticket = new Ticket(@event.Id, seat.Id, user.Id, seat.Price);
        _context.Tickets.Add(ticket);
        await _context.SaveChangesAsync();

        // Simulate ticket created 10 minutes ago (> 5 min hold duration), but still in Pending status (Hangfire lag)
        _context.Entry(ticket).Property(nameof(BaseEntity.CreatedAt)).CurrentValue = DateTime.UtcNow.AddMinutes(-10);
        await _context.SaveChangesAsync();

        var lockService = new Mock<IDistributedLockService>();
        lockService.Setup(x => x.AcquireLockAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TestDistributedLockLease());
        var notifications = new Mock<ISeatNotificationService>();
        var outbox = new Mock<INotificationOutboxPort>();
        var ticketSecurity = new Mock<ITicketSecurityService>();

        var handler = new ProcessPaymentCommandHandler(
            _context, outbox.Object, notifications.Object, lockService.Object,
            ticketSecurity.Object, NullLogger<ProcessPaymentCommandHandler>.Instance);

        var webhookData = new PayOSWebhookData
        {
            OrderCode = ticket.OrderCode,
            Amount = ticket.Price,
            Success = true,
            Reference = "payos-ref-late-123",
            Code = "00"
        };

        var result = await handler.Handle(new ProcessPaymentCommand(webhookData), CancellationToken.None);

        result.Should().BeTrue("expired hold webhook should be acknowledged to stop retries while preserving compensation state");

        // Assert ticket was transitioned from Pending to Cancelled
        var refreshedTicket = await _context.Tickets.AsNoTracking().SingleAsync(t => t.Id == ticket.Id);
        refreshedTicket.Status.Should().Be(TicketStatus.Cancelled);

        // Assert seat was released back to Available
        var refreshedSeat = await _context.Seats.AsNoTracking().SingleAsync(s => s.Id == seat.Id);
        refreshedSeat.Status.Should().Be(SeatStatus.Available);

        // Assert refund request was created for customer compensation
        (await _context.RefundRequests.CountAsync()).Should().Be(1);
        var refundReq = await _context.RefundRequests.SingleAsync();
        refundReq.TicketId.Should().Be(ticket.Id);
        refundReq.Amount.Should().Be(ticket.Price);

        // Assert PaymentTransaction was marked Orphaned with hold expired reason
        var tx = await _context.PaymentTransactions.SingleAsync(p => p.OrderCode == ticket.OrderCode);
        tx.Status.Should().Be("OrphanedPaid");
        tx.RawWebhookPayload.Should().Contain("Reservation hold expired");

        // Assert AuditLog was recorded
        (await _context.AuditLogs.AnyAsync(a => a.Action == "ORPHANED_PAYMENT_DETECTED")).Should().BeTrue();

        // Assert seat status notification was emitted with refreshed seat version
        notifications.Verify(n => n.NotifySeatStatusChanged(@event.Id, seat.Id, SeatStatus.Available.ToString(), It.IsAny<string?>(), null), Times.Once);
    }

    [Fact]
    public async Task ProcessPayment_WhenHoldExpiredAndSeatReclaimedByAnotherUser_PreservesNewUsersSeatLock()
    {
        var userA = new User("CustomerA", $"{Guid.NewGuid():N}@test.local", "hash");
        var userB = new User("CustomerB", $"{Guid.NewGuid():N}@test.local", "hash");
        var @event = CreateEvent("ReclaimedConcert", DateTime.UtcNow.AddDays(2));
        @event.GenerateSeatsMatrix(1, 1);
        _context.AddRange(userA, userB, @event);
        await _context.SaveChangesAsync();

        var seat = await _context.Seats.SingleAsync();
        // User A originally booked
        var ticket = new Ticket(@event.Id, seat.Id, userA.Id, seat.Price);
        _context.Tickets.Add(ticket);
        await _context.SaveChangesAsync();

        // Simulate ticket created 10 minutes ago (> 5 min hold duration)
        _context.Entry(ticket).Property(nameof(BaseEntity.CreatedAt)).CurrentValue = DateTime.UtcNow.AddMinutes(-10);

        // Seat has been subsequently locked by User B
        seat.Lock(userB.Id);
        await _context.SaveChangesAsync();

        var lockService = new Mock<IDistributedLockService>();
        lockService.Setup(x => x.AcquireLockAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TestDistributedLockLease());
        var notifications = new Mock<ISeatNotificationService>();
        var outbox = new Mock<INotificationOutboxPort>();
        var ticketSecurity = new Mock<ITicketSecurityService>();

        var handler = new ProcessPaymentCommandHandler(
            _context, outbox.Object, notifications.Object, lockService.Object,
            ticketSecurity.Object, NullLogger<ProcessPaymentCommandHandler>.Instance);

        var webhookData = new PayOSWebhookData
        {
            OrderCode = ticket.OrderCode,
            Amount = ticket.Price,
            Success = true,
            Reference = "payos-ref-late-userA",
            Code = "00"
        };

        var result = await handler.Handle(new ProcessPaymentCommand(webhookData), CancellationToken.None);

        result.Should().BeTrue();

        // Ticket A was cancelled and orphaned refund request recorded
        var refreshedTicket = await _context.Tickets.AsNoTracking().SingleAsync(t => t.Id == ticket.Id);
        refreshedTicket.Status.Should().Be(TicketStatus.Cancelled);
        (await _context.RefundRequests.AnyAsync(r => r.TicketId == ticket.Id)).Should().BeTrue();

        // Crucial invariant: Seat must STILL be locked by User B, NOT released to Available!
        var refreshedSeat = await _context.Seats.AsNoTracking().SingleAsync(s => s.Id == seat.Id);
        refreshedSeat.Status.Should().Be(SeatStatus.Locked);
        refreshedSeat.LockedByUserId.Should().Be(userB.Id);

        // NotifySeatStatusChanged must NOT broadcast Available
        notifications.Verify(n => n.NotifySeatStatusChanged(@event.Id, seat.Id, SeatStatus.Available.ToString(), null, null), Times.Never);

        // Lock ordering must include seat lock: event:cancel -> seat:lock -> payment:lock
        lockService.Verify(x => x.AcquireLockAsync($"event:cancel:{@event.Id:N}", It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()), Times.Once);
        lockService.Verify(x => x.AcquireLockAsync($"seat:lock:{seat.Id:N}", It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()), Times.Once);
        lockService.Verify(x => x.AcquireLockAsync($"payment:lock:{ticket.OrderCode}", It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task PublicCatalog_CountsExpiredSeatLocksAsAvailable_MatchingDetailView()
    {
        var user = new User("Customer", $"{Guid.NewGuid():N}@test.local", "hash");
        var future = CreateEvent("FutureWithExpiredLock", DateTime.UtcNow.AddDays(2));
        future.GenerateSeatsMatrix(1, 2); // 2 seats total
        _context.AddRange(user, future);
        await _context.SaveChangesAsync();

        var seats = await _context.Seats.Where(s => s.EventId == future.Id).ToListAsync();
        seats[0].Lock(user.Id);
        _context.Entry(seats[0]).Property(nameof(Seat.LockedAt)).CurrentValue = DateTime.UtcNow.AddMinutes(-15);
        await _context.SaveChangesAsync();

        var catalog = new CustomerEventCatalogAdapter(_context, new UtcTimePolicy());
        var catalogResult = await catalog.SearchAsync(new GetEventsQuery(), CancellationToken.None);
        var detailResult = await new GetEventWithSeatsQueryHandler(_context, time: new UtcTimePolicy())
            .Handle(new GetEventWithSeatsQuery(future.Id), CancellationToken.None);

        var catalogEvent = catalogResult.Items.Single(x => x.Id == future.Id);
        catalogEvent.AvailableSeatsCount.Should().Be(2);
        detailResult!.AvailableSeatsCount.Should().Be(2);
    }

    [Fact]
    public async Task PublicCatalog_WhenSortedByPrice_OrdersByEffectiveMinPriceMatchingItemPayload()
    {
        // Event A: BasePrice = 500k, but has an economy seat priced at 100k
        var eventA = new Event("Event A", "Desc", DateTime.UtcNow.AddDays(2), DateTime.UtcNow.AddDays(2).AddHours(2), "Loc", "Venue", 1, basePrice: 500000m);
        // Event B: BasePrice = 300k, and has a standard seat priced at 300k
        var eventB = new Event("Event B", "Desc", DateTime.UtcNow.AddDays(3), DateTime.UtcNow.AddDays(3).AddHours(2), "Loc", "Venue", 1, basePrice: 300000m);
        _context.Events.AddRange(eventA, eventB);
        await _context.SaveChangesAsync();

        var seatA = new Seat(eventA.Id, "A", 1, 100000m, SeatTier.Economy);
        var seatB = new Seat(eventB.Id, "B", 1, 300000m, SeatTier.Standard);
        _context.Seats.AddRange(seatA, seatB);
        await _context.SaveChangesAsync();

        var catalog = new CustomerEventCatalogAdapter(_context, new UtcTimePolicy());
        var ascResult = await catalog.SearchAsync(new GetEventsQuery(SortBy: "price_asc"), CancellationToken.None);

        // Effective min price of Event A is 100k, Event B is 300k. Event A must come first!
        ascResult.Items.Select(x => x.Title).Should().Equal("Event A", "Event B");
        ascResult.Items[0].MinPrice.Should().Be(100000m);
        ascResult.Items[1].MinPrice.Should().Be(300000m);

        var descResult = await catalog.SearchAsync(new GetEventsQuery(SortBy: "price_desc"), CancellationToken.None);
        descResult.Items.Select(x => x.Title).Should().Equal("Event B", "Event A");

        // Verify cursor pagination with effective min price
        var page1 = await catalog.SearchAsync(new GetEventsQuery(SortBy: "price_asc", PageSize: 1), CancellationToken.None);
        page1.Items.Should().ContainSingle(x => x.Title == "Event A");
        page1.NextCursor.Should().NotBeNullOrWhiteSpace();

        var page2 = await catalog.SearchAsync(new GetEventsQuery(SortBy: "price_asc", PageSize: 1, Cursor: page1.NextCursor), CancellationToken.None);
        page2.Items.Should().ContainSingle(x => x.Title == "Event B");
    }

    [Fact]
    public async Task ReservationOperations_ReleaseAsync_RecordsAuditLogWithUserEmail()
    {
        var user = new User("Customer John", "john.doe@example.com", "hash");
        var @event = CreateEvent("Concert", DateTime.UtcNow.AddDays(2));
        _context.Users.Add(user);
        _context.Events.Add(@event);
        await _context.SaveChangesAsync();

        var seat = new Seat(@event.Id, "A", 1, 200000m, SeatTier.Standard);
        _context.Seats.Add(seat);
        await _context.SaveChangesAsync();

        var ticket = new Ticket(@event.Id, seat.Id, user.Id, seat.Price);
        seat.Lock(user.Id);
        _context.Tickets.Add(ticket);
        await _context.SaveChangesAsync();

        var lockService = new Mock<IDistributedLockService>();
        lockService.Setup(x => x.AcquireLockAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TestDistributedLockLease());

        var operations = new ReservationOperations(
            _context,
            lockService.Object,
            Mock.Of<ISeatNotificationService>(),
            Mock.Of<IReservationExpiryScheduler>(),
            Options.Create(new ReservationOptions { HoldMinutes = 10 }),
            NullLogger<ReservationOperations>.Instance,
            new UtcTimePolicy());

        var result = await operations.ReleaseAsync(ticket.Id, user.Id, "User requested cancel", CancellationToken.None);

        result.Success.Should().BeTrue();
        var audit = await _context.AuditLogs.SingleAsync(a => a.Action == "RESERVATION_RELEASED" && a.EntityId == ticket.Id.ToString());
        audit.UserEmail.Should().Be("john.doe@example.com");
    }

    private static Event CreateEvent(string title, DateTime date) =>
        new(title, "Description", date, date.AddHours(2), "HCM", "Venue", 1);

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
}

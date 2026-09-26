using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
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

    [Theory]
    [InlineData(int.MaxValue)]
    [InlineData(42949674)]
    public async Task PublicCatalog_RejectsOverflowingPageOffsetBeforeQuerying(int page)
    {
        var catalog = new CustomerEventCatalogAdapter(_context, new UtcTimePolicy());

        var act = () => catalog.SearchAsync(new GetEventsQuery(Page: page, PageSize: 50), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<FluentValidation.ValidationException>();
        exception.Which.Errors.Should().ContainSingle(error => error.PropertyName == "Page");
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
    public async Task Release_WithPaymentIntent_KeepsSeatWhenProviderStateIsUnknown()
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
        _context.PaymentTransactions.Add(new PaymentTransaction(ticket.OrderCode, ticket.Id, ticket.Price));
        await _context.SaveChangesAsync();
        var locks = new Mock<IDistributedLockService>();
        locks.Setup(x => x.AcquireLockAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>())).ReturnsAsync(new TestDistributedLockLease());
        var payos = new Mock<IPayOSService>();
        var operations = new ReservationOperations(_context, locks.Object, Mock.Of<ISeatNotificationService>(),
            Mock.Of<IReservationExpiryScheduler>(), Options.Create(new ReservationOptions()), NullLogger<ReservationOperations>.Instance,
            payOS: payos.Object);

        var result = await operations.ReleaseAsync(ticket.Id, user.Id, "cancel", CancellationToken.None);

        result.Success.Should().BeFalse();
        (await _context.Tickets.AsNoTracking().SingleAsync()).Status.Should().Be(TicketStatus.Pending);
        (await _context.Seats.AsNoTracking().SingleAsync()).Status.Should().Be(SeatStatus.Locked);
    }

    [Fact]
    public void CancelledTicket_CanRecordConfirmedOrphanCompensationOnlyOnce()
    {
        var ticket = new Ticket(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), 100000);
        ticket.Cancel();

        ticket.CompleteOrphanCompensation(100000);

        ticket.Status.Should().Be(TicketStatus.Cancelled);
        ticket.RefundAmount.Should().Be(100000);
        ticket.RefundedAt.Should().NotBeNull();
        var act = () => ticket.CompleteOrphanCompensation(100000);
        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public async Task Release_WithConfirmedPayOSCancellation_ReleasesSeatAndCancelsIntent()
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
        _context.PaymentTransactions.Add(new PaymentTransaction(ticket.OrderCode, ticket.Id, ticket.Price));
        await _context.SaveChangesAsync();
        var locks = new Mock<IDistributedLockService>();
        var acquiredKeys = new List<string>();
        locks.Setup(x => x.AcquireLockAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .Callback<string, TimeSpan, CancellationToken>((key, _, _) => acquiredKeys.Add(key))
            .ReturnsAsync(new TestDistributedLockLease());
        var payos = new Mock<IPayOSService>();
        payos.Setup(x => x.CancelPaymentLinkAsync(ticket.OrderCode, It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PayOSPaymentLinkState("CANCELLED"));
        var operations = new ReservationOperations(_context, locks.Object, Mock.Of<ISeatNotificationService>(),
            Mock.Of<IReservationExpiryScheduler>(), Options.Create(new ReservationOptions()), NullLogger<ReservationOperations>.Instance,
            payOS: payos.Object);

        var result = await operations.ReleaseAsync(ticket.Id, user.Id, "customer", CancellationToken.None);

        result.Success.Should().BeTrue();
        (await _context.Tickets.AsNoTracking().SingleAsync(x => x.Id == ticket.Id)).Status.Should().Be(TicketStatus.Cancelled);
        (await _context.PaymentTransactions.AsNoTracking().SingleAsync(x => x.TicketId == ticket.Id)).Status.Should().Be("Cancelled");
        (await _context.Seats.AsNoTracking().SingleAsync(x => x.Id == seat.Id)).Status.Should().Be(SeatStatus.Available);
        acquiredKeys.Should().Equal($"payment:lock:{ticket.OrderCode}", $"seat:lock:{seat.Id}");
    }

    [Fact]
    public async Task Reserve_ExpiredSeatWithUnreconciledPaymentIntent_DoesNotReclaim()
    {
        var owner = new User("Owner", $"{Guid.NewGuid():N}@test.local", "hash");
        var next = new User("Next", $"{Guid.NewGuid():N}@test.local", "hash");
        var @event = CreateEvent("Future", DateTime.UtcNow.AddDays(2));
        @event.GenerateSeatsMatrix(1, 1);
        _context.AddRange(owner, next, @event);
        await _context.SaveChangesAsync();
        var seat = await _context.Seats.SingleAsync();
        seat.Lock(owner.Id);
        var old = new Ticket(@event.Id, seat.Id, owner.Id, seat.Price);
        _context.Tickets.Add(old);
        _context.PaymentTransactions.Add(new PaymentTransaction(old.OrderCode, old.Id, old.Price));
        await _context.SaveChangesAsync();
        var locks = new Mock<IDistributedLockService>();
        locks.Setup(x => x.AcquireLockAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>())).ReturnsAsync(new TestDistributedLockLease());
        var operations = new ReservationOperations(_context, locks.Object, Mock.Of<ISeatNotificationService>(),
            Mock.Of<IReservationExpiryScheduler>(), Options.Create(new ReservationOptions { HoldMinutes = 0 }), NullLogger<ReservationOperations>.Instance);

        var result = await operations.ReserveAsync(@event.Id, seat.Id, next.Id, seat.Version, CancellationToken.None);

        result.Code.Should().Be("SEAT_UNAVAILABLE");
        (await _context.Tickets.AsNoTracking().SingleAsync()).Status.Should().Be(TicketStatus.Pending);
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
        page1.Items.Should().HaveCount(2);
        page1.HasNextPage.Should().BeTrue();

        // Page 2 with pageSize 2 -> 2 items
        var page2 = await adapter.GetForUserAsync(user.Id, page: 2, pageSize: 2);
        page2.Items.Should().HaveCount(2);
        page2.HasNextPage.Should().BeTrue();

        // Page 1 and Page 2 items must not overlap
        page1.Items.Select(x => x.Id).Should().NotIntersectWith(page2.Items.Select(x => x.Id));

        var lastPage = await adapter.GetForUserAsync(user.Id, page: 3, pageSize: 2);
        lastPage.Items.Should().HaveCount(2);
        lastPage.HasNextPage.Should().BeFalse();
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
            environment.Object, NullLogger<CustomerCheckoutOperations>.Instance, Mock.Of<IDistributedLockService>(x => x.AcquireLockAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()) == Task.FromResult<IDistributedLockLease?>(new TestDistributedLockLease())));

        var result = await operations.CreatePaymentLinkAsync(ticket.Id, user.Id, CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Code.Should().Be("RESERVATION_EXPIRED");
        payos.Verify(x => x.CreatePaymentLink(It.IsAny<long>(), It.IsAny<int>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>(), It.IsAny<DateTimeOffset?>()), Times.Never);
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
    public async Task SuccessfulWebhook_WhenSeatOwnerChanged_QueuesCompensationWithoutSellingSeat()
    {
        var owner = new User("Owner", $"{Guid.NewGuid():N}@test.local", "hash");
        var next = new User("Next", $"{Guid.NewGuid():N}@test.local", "hash");
        var @event = CreateEvent("Future", DateTime.UtcNow.AddDays(2));
        @event.GenerateSeatsMatrix(1, 1);
        _context.AddRange(owner, next, @event);
        await _context.SaveChangesAsync();
        var seat = await _context.Seats.SingleAsync();
        seat.Lock(owner.Id);
        var ticket = new Ticket(@event.Id, seat.Id, owner.Id, seat.Price);
        _context.Tickets.Add(ticket);
        seat.ReclaimLock(next.Id);
        await _context.SaveChangesAsync();
        var locks = new Mock<IDistributedLockService>();
        locks.Setup(x => x.AcquireLockAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>())).ReturnsAsync(new TestDistributedLockLease());
        var handler = new ProcessPaymentCommandHandler(_context, Mock.Of<INotificationOutboxPort>(), Mock.Of<ISeatNotificationService>(),
            locks.Object, Mock.Of<ITicketSecurityService>(), NullLogger<ProcessPaymentCommandHandler>.Instance);

        var result = await handler.Handle(new ProcessPaymentCommand(new PayOSWebhookData { OrderCode = ticket.OrderCode, Amount = ticket.Price, Success = true, Code = "00" }), CancellationToken.None);

        result.Should().BeTrue();
        ticket.Status.Should().Be(TicketStatus.Cancelled);
        seat.Status.Should().Be(SeatStatus.Locked);
        seat.LockedByUserId.Should().Be(next.Id);
        (await _context.PaymentTransactions.SingleAsync()).Status.Should().Be("OrphanedPaid");
        (await _context.RefundRequests.SingleAsync()).Status.Should().Be("AwaitingDestination");
    }

    [Fact]
    public async Task SuccessfulWebhook_ReplayedAfterCompensation_PreservesRefundedPayment()
    {
        var user = new User("Customer", $"{Guid.NewGuid():N}@test.local", "hash");
        var @event = CreateEvent("Future", DateTime.UtcNow.AddDays(2));
        @event.GenerateSeatsMatrix(1, 1);
        _context.AddRange(user, @event);
        await _context.SaveChangesAsync();
        var ticket = new Ticket(@event.Id, (await _context.Seats.SingleAsync()).Id, user.Id, 100000);
        ticket.Cancel();
        ticket.CompleteOrphanCompensation(ticket.Price);
        var payment = new PaymentTransaction(ticket.OrderCode, ticket.Id, ticket.Price);
        payment.MarkRefunded("confirmed-payout-reference");
        _context.AddRange(ticket, payment);
        await _context.SaveChangesAsync();
        var locks = new Mock<IDistributedLockService>();
        locks.Setup(x => x.AcquireLockAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>())).ReturnsAsync(new TestDistributedLockLease());
        var handler = new ProcessPaymentCommandHandler(_context, Mock.Of<INotificationOutboxPort>(), Mock.Of<ISeatNotificationService>(),
            locks.Object, Mock.Of<ITicketSecurityService>(), NullLogger<ProcessPaymentCommandHandler>.Instance);

        var result = await handler.Handle(new ProcessPaymentCommand(new PayOSWebhookData { OrderCode = ticket.OrderCode, Amount = ticket.Price, Success = true, Reference = "original-payment" }), CancellationToken.None);

        result.Should().BeTrue();
        payment.Status.Should().Be("Refunded");
        payment.ProviderTransactionId.Should().Be("confirmed-payout-reference");
        (await _context.RefundRequests.CountAsync()).Should().Be(0);
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

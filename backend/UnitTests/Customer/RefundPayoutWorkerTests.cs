using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using TickeX.Application.Interfaces;
using TickeX.Domain.Entities;
using TickeX.Domain.Enums;
using TickeX.Infrastructure.Persistence;
using TickeX.Infrastructure.Services;
using Xunit;

namespace TickeX.UnitTests.Customer;

public sealed class RefundPayoutWorkerTests
{
    [Fact]
    public async Task TimeoutAfterProviderAccepts_RetriesWithSameKeyAndCompletesOnlyAfterSuccess()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(connection).Options;
        Guid refundId;
        Guid ticketId;
        await using (var seed = new ApplicationDbContext(options))
        {
            await seed.Database.EnsureCreatedAsync();
            (refundId, ticketId) = await SeedRefundAsync(seed);
        }

        var payout = new FakePayoutService
        {
            Create = (_, _, _, _, _) => throw new TimeoutException("request accepted before client timeout"),
            Find = (_, _) => Task.FromResult(new PayOSPayoutResult(null, "NOT_FOUND", null))
        };
        var services = CreateWorkerServices(options, payout);
        await using var provider = services.BuildServiceProvider();
        using var stop = new CancellationTokenSource();
        var worker = new RefundPayoutWorker(provider.GetRequiredService<IServiceScopeFactory>(), NullLogger<RefundPayoutWorker>.Instance);
        await worker.StartAsync(stop.Token);

        await WaitUntilAsync(async () =>
        {
            await using var check = new ApplicationDbContext(options);
            return await check.RefundRequests.AnyAsync(x => x.Id == refundId && x.Status == "Pending" && x.ProviderStatus == "UNKNOWN");
        }, TimeSpan.FromSeconds(4));

        await using (var check = new ApplicationDbContext(options))
        {
            (await check.Tickets.AsNoTracking().SingleAsync(x => x.Id == ticketId)).Status.Should().Be(TicketStatus.RefundPending);
        }

        await using (var forceRetry = new ApplicationDbContext(options))
            await forceRetry.RefundRequests.Where(x => x.Id == refundId).ExecuteUpdateAsync(s => s.SetProperty(x => x.NextAttemptAt, DateTime.UtcNow.AddMilliseconds(-1)));
        payout.Create = (_, _, _, _, _) => Task.FromResult(new PayOSPayoutResult("payout-id", "SUCCEEDED", null, "970415", "123456789", "TEST ACCOUNT"));

        await WaitUntilAsync(async () =>
        {
            await using var check = new ApplicationDbContext(options);
            return await check.RefundRequests.AnyAsync(x => x.Id == refundId && x.Status == "Completed");
        }, TimeSpan.FromSeconds(8));
        await worker.StopAsync(CancellationToken.None);

        payout.IdempotencyKeys.Should().HaveCount(2);
        payout.IdempotencyKeys.Distinct().Should().ContainSingle();
        payout.ReferenceIds.Should().OnlyContain(x => x == $"refund-{refundId:N}-0");
        await using var final = new ApplicationDbContext(options);
        (await final.Tickets.AsNoTracking().SingleAsync(x => x.Id == ticketId)).Status.Should().Be(TicketStatus.Cancelled);
        (await final.PaymentTransactions.AsNoTracking().SingleAsync(x => x.TicketId == ticketId)).Status.Should().Be("Refunded");
    }

    [Fact]
    public async Task ProcessingPayout_DoesNotCompleteTicket()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(connection).Options;
        Guid refundId;
        Guid ticketId;
        await using (var seed = new ApplicationDbContext(options))
        {
            await seed.Database.EnsureCreatedAsync();
            (refundId, ticketId) = await SeedRefundAsync(seed);
        }
        var payout = new FakePayoutService { Create = (_, _, _, _, _) => Task.FromResult(new PayOSPayoutResult("payout-id", "PROCESSING", null)) };
        await using var provider = CreateWorkerServices(options, payout).BuildServiceProvider();
        using var stop = new CancellationTokenSource();
        var worker = new RefundPayoutWorker(provider.GetRequiredService<IServiceScopeFactory>(), NullLogger<RefundPayoutWorker>.Instance);
        await worker.StartAsync(stop.Token);

        await WaitUntilAsync(async () =>
        {
            await using var check = new ApplicationDbContext(options);
            return await check.RefundRequests.AnyAsync(x => x.Id == refundId && x.ProviderStatus == "PROCESSING");
        }, TimeSpan.FromSeconds(4));
        await worker.StopAsync(CancellationToken.None);

        await using var final = new ApplicationDbContext(options);
        (await final.Tickets.AsNoTracking().SingleAsync(x => x.Id == ticketId)).Status.Should().Be(TicketStatus.RefundPending);
        (await final.RefundRequests.AsNoTracking().SingleAsync(x => x.Id == refundId)).Status.Should().Be("Pending");
    }

    [Fact]
    public async Task TwoWorkers_OnlyOneClaimsAndSubmitsTheSameRefund()
    {
        var connectionString = $"Data Source=refund-worker-{Guid.NewGuid():N};Mode=Memory;Cache=Shared";
        await using var anchor = new SqliteConnection(connectionString);
        await anchor.OpenAsync();
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(connectionString).Options;
        Guid refundId;
        await using (var seed = new ApplicationDbContext(options))
        {
            await seed.Database.EnsureCreatedAsync();
            (refundId, _) = await SeedRefundAsync(seed);
        }
        var payout = new FakePayoutService();
        await using var providerA = CreateWorkerServices(options, payout).BuildServiceProvider();
        await using var providerB = CreateWorkerServices(options, payout).BuildServiceProvider();
        using var stop = new CancellationTokenSource();
        var workerA = new RefundPayoutWorker(providerA.GetRequiredService<IServiceScopeFactory>(), NullLogger<RefundPayoutWorker>.Instance);
        var workerB = new RefundPayoutWorker(providerB.GetRequiredService<IServiceScopeFactory>(), NullLogger<RefundPayoutWorker>.Instance);
        await workerA.StartAsync(stop.Token);
        await workerB.StartAsync(stop.Token);

        await WaitUntilAsync(async () =>
        {
            await using var check = new ApplicationDbContext(options);
            return await check.RefundRequests.AnyAsync(x => x.Id == refundId && x.Status == "Completed");
        }, TimeSpan.FromSeconds(5));
        await Task.WhenAll(workerA.StopAsync(CancellationToken.None), workerB.StopAsync(CancellationToken.None));

        payout.IdempotencyKeys.Should().ContainSingle();
    }

    [Fact]
    public async Task SucceededPayout_ReleasesSoldSeatAndNotifiesSubscribers()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(connection).Options;
        Guid refundId;
        Guid ticketId;
        Guid seatId;
        Guid eventId;
        await using (var seed = new ApplicationDbContext(options))
        {
            await seed.Database.EnsureCreatedAsync();
            (refundId, ticketId) = await SeedRefundAsync(seed);
            var ticket = await seed.Tickets.AsNoTracking().SingleAsync(x => x.Id == ticketId);
            seatId = ticket.SeatId;
            eventId = ticket.EventId;
        }

        var payout = new FakePayoutService();
        var seatNotifications = new Mock<ISeatNotificationService>();
        var catalogCache = new Mock<ICustomerEventCatalogCache>();
        var services = CreateWorkerServices(options, payout, seatNotifications.Object, catalogCache.Object);
        await using var provider = services.BuildServiceProvider();
        using var stop = new CancellationTokenSource();
        var worker = new RefundPayoutWorker(provider.GetRequiredService<IServiceScopeFactory>(), NullLogger<RefundPayoutWorker>.Instance);
        await worker.StartAsync(stop.Token);

        await WaitUntilAsync(async () =>
        {
            await using var check = new ApplicationDbContext(options);
            return await check.RefundRequests.AnyAsync(x => x.Id == refundId && x.Status == "Completed");
        }, TimeSpan.FromSeconds(5));
        await worker.StopAsync(CancellationToken.None);

        await using var final = new ApplicationDbContext(options);
        var updatedSeat = await final.Seats.AsNoTracking().SingleAsync(x => x.Id == seatId);
        updatedSeat.Status.Should().Be(SeatStatus.Available);
        updatedSeat.LockedByUserId.Should().BeNull();
        seatNotifications.Verify(x => x.NotifySeatStatusChanged(eventId, seatId, SeatStatus.Available.ToString(), It.IsAny<string?>(), null), Times.Once);
        catalogCache.Verify(x => x.InvalidateAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RetryRefundRequest_WhenRemoteStateSucceeded_CompletesRefundAndReleasesSoldSeat()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(connection).Options;
        Guid refundId;
        Guid ticketId;
        await using (var seed = new ApplicationDbContext(options))
        {
            await seed.Database.EnsureCreatedAsync();
            (refundId, ticketId) = await SeedRefundAsync(seed);
            var refund = await seed.RefundRequests.SingleAsync(x => x.Id == refundId);
            refund.MarkNeedsReview("Manual check", "PROCESSING");
            await seed.SaveChangesAsync();
        }

        var payout = new FakePayoutService
        {
            Find = (_, _) => Task.FromResult(new PayOSPayoutResult("payout-reconciled", "SUCCEEDED", null, "970415", "123456789", "TEST ACCOUNT"))
        };
        var protector = new Mock<IRefundBankAccountProtector>();
        protector.Setup(x => x.Unprotect("encrypted-destination"))
            .Returns(new RefundBankAccountDetails("970415", "TEST ACCOUNT", "123456789"));
        var locks = new Mock<IDistributedLockService>();
        var lease = new Mock<IDistributedLockLease>();
        lease.SetupGet(x => x.IsValid).Returns(true);
        locks.Setup(x => x.AcquireLockAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(lease.Object);
        var seatNotifications = new Mock<ISeatNotificationService>();
        var catalogCache = new Mock<ICustomerEventCatalogCache>();

        await using var db = new ApplicationDbContext(options);
        var handler = new TickeX.Application.Admin.Commands.RetryRefundRequestCommandHandler(
            db, payout, protector.Object, locks.Object, seatNotifications.Object, catalogCache.Object);

        var outcome = await handler.Handle(new TickeX.Application.Admin.Commands.RetryRefundRequestCommand(refundId), CancellationToken.None);

        outcome.Should().Be("REFUND_COMPLETED");
        var seat = await db.Seats.AsNoTracking().SingleAsync();
        seat.Status.Should().Be(SeatStatus.Available);
        seatNotifications.Verify(x => x.NotifySeatStatusChanged(It.IsAny<Guid>(), seat.Id, SeatStatus.Available.ToString(), It.IsAny<string?>(), null), Times.Once);
        catalogCache.Verify(x => x.InvalidateAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    private static ServiceCollection CreateWorkerServices(
        DbContextOptions<ApplicationDbContext> options,
        FakePayoutService payout,
        ISeatNotificationService? seatNotifications = null,
        ICustomerEventCatalogCache? catalogCache = null)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddScoped(_ => new ApplicationDbContext(options));
        services.AddSingleton<IPayOSPayoutService>(payout);
        var protector = new Mock<IRefundBankAccountProtector>();
        protector.Setup(x => x.Unprotect("encrypted-destination")).Returns(new RefundBankAccountDetails("970415", "TEST ACCOUNT", "123456789"));
        services.AddSingleton(protector.Object);
        if (seatNotifications is not null) services.AddSingleton(seatNotifications);
        if (catalogCache is not null) services.AddSingleton(catalogCache);
        return services;
    }

    private static async Task<(Guid RefundId, Guid TicketId)> SeedRefundAsync(ApplicationDbContext db)
    {
        var user = new User("Customer", $"{Guid.NewGuid():N}@test.local", "hash");
        var ev = new Event("Future", "Description", DateTime.UtcNow.AddDays(3), DateTime.UtcNow.AddDays(3).AddHours(2), "HCM", "Venue", 1);
        ev.GenerateSeatsMatrix(1, 1);
        db.AddRange(user, ev);
        await db.SaveChangesAsync();
        var seat = await db.Seats.SingleAsync();
        seat.Lock(user.Id);
        seat.MarkAsSold();
        var ticket = new Ticket(ev.Id, seat.Id, user.Id, seat.Price);
        ticket.MarkAsPaid();
        ticket.MarkRefundPending();
        db.Tickets.Add(ticket);
        var payment = new PaymentTransaction(ticket.OrderCode, ticket.Id, ticket.Price);
        payment.MarkSuccess("payment-reference");
        payment.MarkRefundInitiated();
        db.PaymentTransactions.Add(payment);
        var refund = new RefundRequest(ev.Id, ticket.Id, ticket.Price, $"customer-refund:{ticket.Id:N}");
        refund.SetDestinationSnapshot("encrypted-destination");
        db.RefundRequests.Add(refund);
        await db.SaveChangesAsync();
        return (refund.Id, ticket.Id);
    }

    private static async Task WaitUntilAsync(Func<Task<bool>> predicate, TimeSpan timeout)
    {
        var until = DateTime.UtcNow + timeout;
        while (DateTime.UtcNow < until)
        {
            if (await predicate()) return;
            await Task.Delay(50);
        }
        throw new TimeoutException("Refund worker did not reach the expected persisted state.");
    }

    private sealed class FakePayoutService : IPayOSPayoutService
    {
        private readonly object _sync = new();
        public Func<string, string, long, RefundBankAccountDetails, CancellationToken, Task<PayOSPayoutResult>> Create { get; set; }
            = (_, _, _, _, _) => Task.FromResult(new PayOSPayoutResult("payout-id", "SUCCEEDED", null, "970415", "123456789", "TEST ACCOUNT"));
        public Func<string, CancellationToken, Task<PayOSPayoutResult>> Find { get; set; }
            = (_, _) => Task.FromResult(new PayOSPayoutResult(null, "NOT_FOUND", null));
        public List<string> IdempotencyKeys { get; } = [];
        public List<string> ReferenceIds { get; } = [];

        public Task<PayOSPayoutResult> CreateOrGetAsync(string referenceId, string idempotencyKey, long amount, RefundBankAccountDetails destination, CancellationToken cancellationToken)
        {
            lock (_sync) { ReferenceIds.Add(referenceId); IdempotencyKeys.Add(idempotencyKey); }
            return Create(referenceId, idempotencyKey, amount, destination, cancellationToken);
        }
        public Task<PayOSPayoutResult> GetStatusAsync(string payoutId, CancellationToken cancellationToken) => Task.FromResult(new PayOSPayoutResult(payoutId, "PROCESSING", null));
        public Task<PayOSPayoutResult> FindByReferenceAsync(string referenceId, CancellationToken cancellationToken) => Find(referenceId, cancellationToken);
    }
}
